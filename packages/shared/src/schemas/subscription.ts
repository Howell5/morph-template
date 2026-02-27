import { z } from "zod";

/**
 * Subscription tier enum
 */
export const subscriptionTierEnum = z.enum(["free", "starter", "pro", "max"]);
export type SubscriptionTier = z.infer<typeof subscriptionTierEnum>;

/**
 * Billing interval enum
 */
export const billingIntervalEnum = z.enum(["month", "year"]);
export type BillingInterval = z.infer<typeof billingIntervalEnum>;

/**
 * Plan ID for checkout (excludes free tier)
 */
export const planIdEnum = z.enum(["starter", "pro", "max"]);
export type PlanId = z.infer<typeof planIdEnum>;

/**
 * Schema for creating a subscription checkout session
 */
export const createSubscriptionCheckoutSchema = z.object({
  planId: planIdEnum,
  interval: billingIntervalEnum.default("month"),
});

export type CreateSubscriptionCheckout = z.infer<typeof createSubscriptionCheckoutSchema>;

/**
 * Subscription plan limits - single source of truth
 */
export const PLAN_LIMITS = {
  // Monthly pricing (in dollars)
  STARTER_PRICE: 12,
  PRO_PRICE: 24,
  MAX_PRICE: 240,

  // Annual pricing (in dollars)
  STARTER_ANNUAL_PRICE: 108, // $9/month equivalent
  PRO_ANNUAL_PRICE: 228, // $19/month equivalent
  MAX_ANNUAL_PRICE: 2400, // $200/month equivalent
} as const;

/**
 * Get annual price for a plan
 */
export function getAnnualPrice(monthlyPrice: number): number {
  switch (monthlyPrice) {
    case PLAN_LIMITS.STARTER_PRICE:
      return PLAN_LIMITS.STARTER_ANNUAL_PRICE;
    case PLAN_LIMITS.PRO_PRICE:
      return PLAN_LIMITS.PRO_ANNUAL_PRICE;
    case PLAN_LIMITS.MAX_PRICE:
      return PLAN_LIMITS.MAX_ANNUAL_PRICE;
    default:
      return monthlyPrice * 12;
  }
}

/**
 * Get monthly equivalent price for annual billing
 */
export function getAnnualMonthlyPrice(monthlyPrice: number): number {
  return Math.floor(getAnnualPrice(monthlyPrice) / 12);
}

/**
 * Get the price in cents for Stripe checkout
 */
export function getPriceInCents(monthlyPrice: number, interval: BillingInterval): number {
  if (interval === "year") {
    return getAnnualPrice(monthlyPrice) * 100;
  }
  return monthlyPrice * 100;
}

/**
 * Subscription status response schema
 */
export const subscriptionStatusSchema = z.object({
  tier: subscriptionTierEnum,
  expiresAt: z.string().datetime().nullable(),
  // Credits
  dailyCredits: z.number().int().min(0),
  subscriptionCredits: z.number().int().min(0),
  subscriptionCreditsLimit: z.number().int().min(0),
  bonusCredits: z.number().int().min(0),
  totalCredits: z.number().int().min(0),
  dailyResetsAt: z.string().datetime().nullable(),
  subscriptionResetsAt: z.string().datetime().nullable(),
});

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
