/**
 * Credits system configuration - single source of truth (v3)
 *
 * Three types of credits:
 * 1. Daily credits: Login reward (50/day), expires at end of day UTC
 * 2. Subscription credits: Based on tier, resets on subscription renewal
 * 3. Bonus credits: From purchases, referrals, admin grants - never expire
 *
 * Consumption priority: Daily -> Subscription -> Bonus
 */

import type { SubscriptionTier } from "../schemas/subscription";

export const CREDITS_CONFIG = {
  // Daily login reward (expires at end of day UTC)
  DAILY_LOGIN_REWARD: 50,

  // Subscription credits by tier (resets on subscription renewal)
  SUBSCRIPTION_FREE: 0,
  SUBSCRIPTION_STARTER: 1300,
  SUBSCRIPTION_PRO: 2700,
  SUBSCRIPTION_MAX: 30000,

  // Minimum credits required to start a generation (pre-check threshold)
  MIN_RESERVE_CREDITS: 5,
} as const;

/**
 * Get subscription credits limit based on tier
 * Returns 0 for free tier (free users don't get subscription credits)
 */
export function getSubscriptionCreditsLimit(
  tier: SubscriptionTier,
  subscriptionExpiresAt?: Date | null,
): number {
  // Check if subscription has expired
  const isExpired = subscriptionExpiresAt && subscriptionExpiresAt < new Date();
  if (isExpired || tier === "free") {
    return CREDITS_CONFIG.SUBSCRIPTION_FREE;
  }

  switch (tier) {
    case "max":
      return CREDITS_CONFIG.SUBSCRIPTION_MAX;
    case "pro":
      return CREDITS_CONFIG.SUBSCRIPTION_PRO;
    case "starter":
      return CREDITS_CONFIG.SUBSCRIPTION_STARTER;
    default:
      return CREDITS_CONFIG.SUBSCRIPTION_FREE;
  }
}
