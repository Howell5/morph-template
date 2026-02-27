import { type SubscriptionTier, getSubscriptionCreditsLimit } from "@repo/shared";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type Stripe from "stripe";
import { db } from "../db";
import { creditRecords, orders, user } from "../db/schema";
import { errors, ok } from "../lib/response";
import { getStripe } from "../lib/stripe";

const webhooksRoute = new Hono()
  /**
   * POST /webhooks/stripe
   * Handle Stripe webhook events
   */
  .post("/stripe", async (c) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("Stripe webhook received but Stripe is not configured");
      return errors.serviceUnavailable(c, "Stripe is not configured");
    }

    const stripe = getStripe();
    const signature = c.req.header("stripe-signature");

    if (!signature) {
      return errors.badRequest(c, "Missing stripe-signature header");
    }

    let event: Stripe.Event;

    try {
      const rawBody = await c.req.text();
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return errors.badRequest(c, "Invalid signature");
    }

    console.log(`Stripe webhook received: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return ok(c, { received: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return errors.internal(c, "Failed to process webhook");
    }
  });

/**
 * Handle checkout.session.completed event
 * Routes to credit purchase or subscription handler based on metadata type
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const type = session.metadata?.type;

  if (!userId) {
    console.error("Missing userId in checkout session metadata:", session.id);
    return;
  }

  if (type === "credits") {
    await handleCreditPurchase(session);
  } else if (type === "subscription") {
    await handleSubscriptionCheckoutCompleted(session);
  } else {
    // Fallback for old webhooks without type metadata
    await handleCreditPurchase(session);
  }
}

/**
 * Handle credit package purchase
 * Purchased credits go to bonusCredits (never expire)
 */
async function handleCreditPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const packageId = session.metadata?.packageId;
  const creditsStr = session.metadata?.credits;

  if (!userId || !packageId || !creditsStr) {
    console.error("Missing required metadata in credit purchase:", session.metadata);
    return;
  }

  const credits = Number.parseInt(creditsStr, 10);
  if (Number.isNaN(credits) || credits <= 0 || credits > 1000000) {
    console.error("Invalid credits value:", creditsStr);
    return;
  }

  await db.transaction(async (tx) => {
    // Atomic idempotency: INSERT ... ON CONFLICT DO NOTHING
    const insertResult = await tx
      .insert(orders)
      .values({
        userId,
        packageId,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        credits,
        status: "completed",
        stripeSessionId: session.id,
      })
      .onConflictDoNothing({ target: orders.stripeSessionId })
      .returning({ id: orders.id });

    if (insertResult.length === 0) {
      console.log(`Order already processed for session ${session.id}`);
      return;
    }

    // Get current balance for record
    const userData = await tx.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        bonusCredits: true,
        dailyCredits: true,
        subscriptionCredits: true,
      },
    });

    const currentBonus = userData?.bonusCredits ?? 0;
    const totalBefore =
      currentBonus + (userData?.dailyCredits ?? 0) + (userData?.subscriptionCredits ?? 0);

    // Add credits to bonus balance (never expire)
    await tx
      .update(user)
      .set({
        bonusCredits: sql`${user.bonusCredits} + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Create credit record
    await tx.insert(creditRecords).values({
      userId,
      type: "purchase",
      amount: credits,
      balanceBefore: totalBefore,
      balanceAfter: totalBefore + credits,
      creditPool: "bonus",
      metadata: { packageId, stripeSessionId: session.id },
    });

    console.log(`Credit pack purchased: ${credits} bonus credits added to user ${userId}`);
  });
}

/**
 * Handle subscription checkout completed
 * Backup mechanism: upgrades user from checkout session
 */
async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  if (!userId || !planId) {
    console.error("Missing required metadata in subscription checkout:", session.metadata);
    return;
  }

  const validTiers = ["starter", "pro", "max"];
  if (!validTiers.includes(planId)) {
    console.error("Invalid planId in subscription checkout:", planId);
    return;
  }

  const stripe = getStripe();
  const subscriptionId = session.subscription as string | null;

  if (!subscriptionId) {
    console.error("No subscription ID in checkout session:", session.id);
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    const subscriptionCreditsAmount = getSubscriptionCreditsLimit(
      planId as SubscriptionTier,
      currentPeriodEnd,
    );

    await db.transaction(async (tx) => {
      const insertResult = await tx
        .insert(orders)
        .values({
          userId,
          packageId: `${planId}-subscription`,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          credits: subscriptionCreditsAmount,
          status: "completed",
          stripeSessionId: session.id,
        })
        .onConflictDoNothing({ target: orders.stripeSessionId })
        .returning({ id: orders.id });

      if (insertResult.length === 0) {
        console.log(`Subscription order already processed for session ${session.id}`);
        return;
      }

      await tx
        .update(user)
        .set({
          subscriptionTier: planId,
          subscriptionExpiresAt: currentPeriodEnd,
          stripeSubscriptionId: subscriptionId,
          subscriptionCredits: subscriptionCreditsAmount,
          subscriptionCreditsResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      // Create credit record for subscription reset
      await tx.insert(creditRecords).values({
        userId,
        type: "subscription_reset",
        amount: subscriptionCreditsAmount,
        balanceBefore: 0,
        balanceAfter: subscriptionCreditsAmount,
        creditPool: "subscription",
        metadata: { planId, subscriptionId },
      });

      console.log(`Subscription activated via checkout for user ${userId}, tier: ${planId}`);
    });
  } catch (error) {
    console.error("Error handling subscription checkout:", error);
  }
}

/**
 * Handle subscription created or updated
 * Resets subscription credits to full tier amount
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const userData = await db.query.user.findFirst({
    where: eq(user.stripeCustomerId, customerId),
    columns: { id: true },
  });

  if (!userData) {
    console.error(`User not found for Stripe customer: ${customerId}`);
    return;
  }

  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  const isActive = status === "active" || status === "trialing";
  const planId = subscription.metadata?.planId || "pro";

  const validTiers = ["starter", "pro", "max"];
  const tier = isActive && validTiers.includes(planId) ? planId : "free";

  const subscriptionCreditsAmount = getSubscriptionCreditsLimit(
    tier as SubscriptionTier,
    currentPeriodEnd,
  );

  if (isActive) {
    await db
      .update(user)
      .set({
        subscriptionTier: tier,
        subscriptionExpiresAt: currentPeriodEnd,
        stripeSubscriptionId: subscription.id,
        subscriptionCredits: subscriptionCreditsAmount,
        subscriptionCreditsResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userData.id));
  } else {
    await db
      .update(user)
      .set({
        subscriptionTier: tier,
        subscriptionExpiresAt: currentPeriodEnd,
        stripeSubscriptionId: subscription.id,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userData.id));
  }

  console.log(
    `Subscription ${isActive ? "activated" : "updated"} for user ${userData.id}, tier: ${tier}`,
  );
}

/**
 * Handle subscription deleted (canceled)
 * Downgrades to free tier, clears subscription credits
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const userData = await db.query.user.findFirst({
    where: eq(user.stripeCustomerId, customerId),
    columns: { id: true },
  });

  if (!userData) {
    console.error(`User not found for Stripe customer: ${customerId}`);
    return;
  }

  await db
    .update(user)
    .set({
      subscriptionTier: "free",
      subscriptionExpiresAt: null,
      stripeSubscriptionId: null,
      subscriptionCredits: 0,
      subscriptionCreditsResetAt: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userData.id));

  console.log(`Subscription canceled for user ${userData.id}, downgraded to free`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const userData = await db.query.user.findFirst({
    where: eq(user.stripeCustomerId, customerId),
    columns: { id: true, email: true },
  });

  if (!userData) {
    console.error(`User not found for Stripe customer: ${customerId}`);
    return;
  }

  console.log(`Payment failed for user ${userData.id} (${userData.email})`);
}

export default webhooksRoute;
