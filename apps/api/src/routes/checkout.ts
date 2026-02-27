import { zValidator } from "@hono/zod-validator";
import {
  createCheckoutSchema,
  createSubscriptionCheckoutSchema,
  getCreditPackage,
  getPriceInCents,
  getPricingPlan,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/schema";
import { errors, ok } from "../lib/response";
import { getStripe } from "../lib/stripe";

const checkoutRoute = new Hono()
  /**
   * POST /checkout
   * Create a Stripe Checkout session for purchasing credit packs
   */
  .post("/", zValidator("json", createCheckoutSchema), async (c) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return errors.serviceUnavailable(
        c,
        "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.",
      );
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { packageId } = c.req.valid("json");

    const creditPackage = getCreditPackage(packageId);
    if (!creditPackage) {
      return errors.badRequest(c, "Invalid package ID");
    }

    try {
      const stripe = getStripe();
      const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

      const checkoutSession = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: creditPackage.currency,
              product_data: {
                name: creditPackage.name,
                description: `${creditPackage.credits} credits`,
              },
              unit_amount: creditPackage.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${FRONTEND_URL.replace(/\/$/, "")}/dashboard/orders?success=true`,
        cancel_url: `${FRONTEND_URL.replace(/\/$/, "")}/pricing?canceled=true`,
        client_reference_id: session.user.id,
        metadata: {
          userId: session.user.id,
          packageId: creditPackage.id,
          credits: creditPackage.credits.toString(),
          type: "credits",
        },
      });

      if (!checkoutSession.url) {
        return errors.internal(c, "Failed to create checkout session");
      }

      return ok(c, {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      });
    } catch (error) {
      console.error("Stripe checkout error:", error);
      return errors.internal(c, "Failed to create checkout session");
    }
  })

  /**
   * POST /checkout/subscription
   * Create a Stripe Checkout session for subscription plans
   */
  .post("/subscription", zValidator("json", createSubscriptionCheckoutSchema), async (c) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return errors.serviceUnavailable(
        c,
        "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.",
      );
    }

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { planId, interval } = c.req.valid("json");

    const plan = getPricingPlan(planId);
    if (!plan || plan.id === "free") {
      return errors.badRequest(c, "Invalid plan ID");
    }

    const priceInCents = getPriceInCents(plan.monthlyPrice, interval);

    try {
      const stripe = getStripe();
      const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

      // Get or create Stripe customer
      let stripeCustomerId: string;
      const userData = await db.query.user.findFirst({
        where: eq(user.id, session.user.id),
        columns: { stripeCustomerId: true },
      });

      if (userData?.stripeCustomerId) {
        stripeCustomerId = userData.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: session.user.email,
          name: session.user.name,
          metadata: { userId: session.user.id },
        });
        stripeCustomerId = customer.id;

        await db
          .update(user)
          .set({
            stripeCustomerId: customer.id,
            updatedAt: new Date(),
          })
          .where(eq(user.id, session.user.id));
      }

      // Check for pre-configured Stripe Price ID from env
      const envPriceIdKey = `STRIPE_${planId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
      const stripePriceId = process.env[envPriceIdKey];

      const planDisplayName = `${plan.name} - ${interval === "year" ? "Annual" : "Monthly"}`;

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        line_items: stripePriceId
          ? [{ price: stripePriceId, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: plan.currency,
                  product_data: {
                    name: planDisplayName,
                    description: plan.description,
                  },
                  unit_amount: priceInCents,
                  recurring: { interval },
                },
                quantity: 1,
              },
            ],
        mode: "subscription",
        success_url: `${FRONTEND_URL.replace(/\/$/, "")}/dashboard?success=${planId}`,
        cancel_url: `${FRONTEND_URL.replace(/\/$/, "")}/pricing?canceled=true`,
        client_reference_id: session.user.id,
        metadata: {
          userId: session.user.id,
          planId,
          interval,
          type: "subscription",
        },
        subscription_data: {
          metadata: {
            userId: session.user.id,
            planId,
            interval,
          },
        },
      });

      if (!checkoutSession.url) {
        return errors.internal(c, "Failed to create checkout session");
      }

      return ok(c, {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      });
    } catch (error) {
      console.error("Stripe subscription checkout error:", error);
      return errors.internal(c, "Failed to create checkout session");
    }
  })

  /**
   * POST /checkout/manage
   * Create a Stripe Customer Portal session for managing subscription
   */
  .post("/manage", async (c) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return errors.serviceUnavailable(c, "Stripe is not configured");
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    try {
      const stripe = getStripe();
      const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

      const userData = await db.query.user.findFirst({
        where: eq(user.id, session.user.id),
        columns: { stripeCustomerId: true },
      });

      if (!userData?.stripeCustomerId) {
        return errors.badRequest(c, "No billing account found. Please make a purchase first.");
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: userData.stripeCustomerId,
        return_url: `${FRONTEND_URL.replace(/\/$/, "")}/`,
      });

      return ok(c, { portalUrl: portalSession.url });
    } catch (error) {
      console.error("Stripe portal error:", error);
      return errors.internal(c, "Failed to create portal session");
    }
  });

export default checkoutRoute;
