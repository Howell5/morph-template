/**
 * Entitlements Service
 *
 * Provides a single function to check what features a user has access to
 * based on their subscription tier.
 */

import type { SubscriptionTier } from "@repo/shared";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";
import { getEffectiveTier, getUserCreditsBalance } from "./credits-service";

export interface UserEntitlements {
  userId: string;
  tier: SubscriptionTier;
  // Credits
  dailyCredits: number;
  subscriptionCredits: number;
  subscriptionCreditsLimit: number;
  bonusCredits: number;
  totalCredits: number;
  dailyResetsAt: Date;
  subscriptionResetsAt: Date | null;
}

// Simple TTL cache
const cache = new Map<string, { data: UserEntitlements; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get user entitlements (cached)
 */
export async function getUserEntitlements(userId: string): Promise<UserEntitlements | null> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  return getUserEntitlementsFresh(userId);
}

/**
 * Get user entitlements (bypass cache)
 * Use after purchases or subscription changes
 */
export async function getUserEntitlementsFresh(userId: string): Promise<UserEntitlements | null> {
  const userData = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      id: true,
      subscriptionTier: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!userData) return null;

  const effectiveTier = getEffectiveTier(userData.subscriptionTier, userData.subscriptionExpiresAt);

  const balance = await getUserCreditsBalance(userId);
  if (!balance) return null;

  const entitlements: UserEntitlements = {
    userId,
    tier: effectiveTier,
    dailyCredits: balance.dailyCredits,
    subscriptionCredits: balance.subscriptionCredits,
    subscriptionCreditsLimit: balance.subscriptionCreditsLimit,
    bonusCredits: balance.bonusCredits,
    totalCredits: balance.totalAvailable,
    dailyResetsAt: balance.dailyResetsAt,
    subscriptionResetsAt: balance.subscriptionResetsAt,
  };

  cache.set(userId, {
    data: entitlements,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return entitlements;
}

/**
 * Invalidate entitlements cache for a user
 */
export function invalidateEntitlementsCache(userId: string): void {
  cache.delete(userId);
}

/**
 * Check if user is on a paid tier
 */
export function isProUser(tier: SubscriptionTier): boolean {
  return tier === "starter" || tier === "pro" || tier === "max";
}
