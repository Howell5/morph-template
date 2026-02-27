/**
 * Credits Service - Core business logic for the three-pool credits system
 *
 * Three types of credits:
 * 1. Daily credits: Login reward (50/day), expires at end of day UTC
 * 2. Subscription credits: Based on tier, resets on subscription renewal
 * 3. Bonus credits: From purchases, referrals, admin grants - never expire
 *
 * Consumption priority: Daily -> Subscription -> Bonus
 */

import { CREDITS_CONFIG, type SubscriptionTier, getSubscriptionCreditsLimit } from "@repo/shared";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { creditRecords, user } from "../db/schema";

// ============= Types =============

export interface CreditsBalance {
  dailyCredits: number;
  subscriptionCredits: number;
  subscriptionCreditsLimit: number;
  bonusCredits: number;
  totalAvailable: number;
  dailyResetsAt: Date;
  subscriptionResetsAt: Date | null;
}

export type CreditsCheckResult =
  | { allowed: true; balance: CreditsBalance }
  | { allowed: false; reason: string; code: string; balance?: CreditsBalance };

export type ConsumeCreditsResult =
  | { success: true; creditsConsumed: number; balance: CreditsBalance }
  | { success: false; reason: string; code: string };

// ============= Helper Functions =============

/**
 * Check if daily reset is needed (different UTC day)
 */
export function needsDailyReset(lastResetAt: Date | null): boolean {
  if (!lastResetAt) return true;

  const now = new Date();
  const lastReset = new Date(lastResetAt);

  return (
    now.getUTCDate() !== lastReset.getUTCDate() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear()
  );
}

/**
 * Get next day's start at UTC midnight
 */
export function getNextDayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/**
 * Get effective subscription tier (handles subscription expiration)
 */
export function getEffectiveTier(tier: string | null, expiresAt: Date | null): SubscriptionTier {
  if (!tier || tier === "free") return "free";

  if (expiresAt && expiresAt < new Date()) {
    return "free";
  }

  const validTiers: SubscriptionTier[] = ["starter", "pro", "max"];
  if (validTiers.includes(tier as SubscriptionTier)) {
    return tier as SubscriptionTier;
  }

  return "free";
}

/**
 * Build credits balance object
 */
function buildCreditsBalance(
  dailyCredits: number,
  subscriptionCredits: number,
  subscriptionCreditsLimit: number,
  bonusCredits: number,
  subscriptionExpiresAt: Date | null,
): CreditsBalance {
  return {
    dailyCredits,
    subscriptionCredits,
    subscriptionCreditsLimit,
    bonusCredits,
    totalAvailable: dailyCredits + subscriptionCredits + bonusCredits,
    dailyResetsAt: getNextDayStart(),
    subscriptionResetsAt: subscriptionExpiresAt,
  };
}

// ============= Core Business Logic =============

/**
 * Get user's current credits balance
 * Handles daily reset (clears daily credits if new day)
 */
export async function getUserCreditsBalance(userId: string): Promise<CreditsBalance | null> {
  return db.transaction(async (tx) => {
    const userData = await tx.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        dailyCredits: true,
        dailyCreditsResetAt: true,
        subscriptionCredits: true,
        bonusCredits: true,
      },
    });

    if (!userData) return null;

    const effectiveTier = getEffectiveTier(
      userData.subscriptionTier,
      userData.subscriptionExpiresAt,
    );
    const subscriptionLimit = getSubscriptionCreditsLimit(
      effectiveTier,
      userData.subscriptionExpiresAt,
    );

    let dailyCredits = userData.dailyCredits ?? 0;

    // Daily credits expire at end of day - reset to 0 if new day
    if (needsDailyReset(userData.dailyCreditsResetAt)) {
      dailyCredits = 0;
      await tx
        .update(user)
        .set({
          dailyCredits: 0,
          dailyCreditsResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    }

    return buildCreditsBalance(
      dailyCredits,
      userData.subscriptionCredits ?? 0,
      subscriptionLimit,
      userData.bonusCredits ?? 0,
      userData.subscriptionExpiresAt,
    );
  });
}

/**
 * Grant daily login reward
 * Called when user visits, sets daily credits to DAILY_LOGIN_REWARD
 */
export async function grantDailyLoginReward(userId: string): Promise<CreditsBalance | null> {
  return db.transaction(async (tx) => {
    const userData = await tx.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        dailyCredits: true,
        dailyCreditsResetAt: true,
        subscriptionCredits: true,
        bonusCredits: true,
      },
    });

    if (!userData) return null;

    const effectiveTier = getEffectiveTier(
      userData.subscriptionTier,
      userData.subscriptionExpiresAt,
    );
    const subscriptionLimit = getSubscriptionCreditsLimit(
      effectiveTier,
      userData.subscriptionExpiresAt,
    );

    // Only grant if it's a new day (haven't received today's reward yet)
    if (needsDailyReset(userData.dailyCreditsResetAt)) {
      await tx
        .update(user)
        .set({
          dailyCredits: CREDITS_CONFIG.DAILY_LOGIN_REWARD,
          dailyCreditsResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      // Create credit record for daily login
      const balanceBefore = 0 + (userData.subscriptionCredits ?? 0) + (userData.bonusCredits ?? 0);
      await tx.insert(creditRecords).values({
        userId,
        type: "daily_login",
        amount: CREDITS_CONFIG.DAILY_LOGIN_REWARD,
        balanceBefore,
        balanceAfter: balanceBefore + CREDITS_CONFIG.DAILY_LOGIN_REWARD,
        creditPool: "daily",
      });

      return buildCreditsBalance(
        CREDITS_CONFIG.DAILY_LOGIN_REWARD,
        userData.subscriptionCredits ?? 0,
        subscriptionLimit,
        userData.bonusCredits ?? 0,
        userData.subscriptionExpiresAt,
      );
    }

    // Already received today's reward
    return buildCreditsBalance(
      userData.dailyCredits ?? 0,
      userData.subscriptionCredits ?? 0,
      subscriptionLimit,
      userData.bonusCredits ?? 0,
      userData.subscriptionExpiresAt,
    );
  });
}

/**
 * Pre-check if user has enough credits to start generation
 * Does NOT consume credits - just validates minimum reserve
 */
export async function checkCreditsReserve(userId: string): Promise<CreditsCheckResult> {
  return db.transaction(async (tx) => {
    const userData = await tx.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        dailyCredits: true,
        dailyCreditsResetAt: true,
        subscriptionCredits: true,
        bonusCredits: true,
      },
    });

    if (!userData) {
      return {
        allowed: false,
        reason: "User not found",
        code: "USER_NOT_FOUND",
      };
    }

    const effectiveTier = getEffectiveTier(
      userData.subscriptionTier,
      userData.subscriptionExpiresAt,
    );
    const subscriptionLimit = getSubscriptionCreditsLimit(
      effectiveTier,
      userData.subscriptionExpiresAt,
    );

    let dailyCredits = userData.dailyCredits ?? 0;
    if (needsDailyReset(userData.dailyCreditsResetAt)) {
      dailyCredits = 0;
      await tx
        .update(user)
        .set({
          dailyCredits: 0,
          dailyCreditsResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    }

    const subscriptionCredits = userData.subscriptionCredits ?? 0;
    const bonusCredits = userData.bonusCredits ?? 0;
    const totalAvailable = dailyCredits + subscriptionCredits + bonusCredits;

    const balance = buildCreditsBalance(
      dailyCredits,
      subscriptionCredits,
      subscriptionLimit,
      bonusCredits,
      userData.subscriptionExpiresAt,
    );

    if (totalAvailable < CREDITS_CONFIG.MIN_RESERVE_CREDITS) {
      return {
        allowed: false,
        reason: "Insufficient credits",
        code: "INSUFFICIENT_CREDITS",
        balance,
      };
    }

    return { allowed: true, balance };
  });
}

/**
 * Consume credits with three-pool priority: Daily -> Subscription -> Bonus
 */
export async function consumeCredits(
  userId: string,
  cost: number,
  metadata?: Record<string, unknown>,
): Promise<ConsumeCreditsResult> {
  return db.transaction(async (tx) => {
    const userData = await tx.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
        dailyCredits: true,
        dailyCreditsResetAt: true,
        subscriptionCredits: true,
        bonusCredits: true,
      },
    });

    if (!userData) {
      return {
        success: false,
        reason: "User not found",
        code: "USER_NOT_FOUND",
      };
    }

    const effectiveTier = getEffectiveTier(
      userData.subscriptionTier,
      userData.subscriptionExpiresAt,
    );
    const subscriptionLimit = getSubscriptionCreditsLimit(
      effectiveTier,
      userData.subscriptionExpiresAt,
    );

    // Get current balances (handle daily reset)
    let dailyCredits = userData.dailyCredits ?? 0;
    if (needsDailyReset(userData.dailyCreditsResetAt)) {
      dailyCredits = 0;
    }
    let subscriptionCredits = userData.subscriptionCredits ?? 0;
    let bonusCredits = userData.bonusCredits ?? 0;

    // Consume in priority order: Daily -> Subscription -> Bonus
    let remaining = cost;

    const fromDaily = Math.min(remaining, dailyCredits);
    dailyCredits -= fromDaily;
    remaining -= fromDaily;

    const fromSubscription = Math.min(remaining, subscriptionCredits);
    subscriptionCredits -= fromSubscription;
    remaining -= fromSubscription;

    const fromBonus = Math.min(remaining, bonusCredits);
    bonusCredits -= fromBonus;
    remaining -= fromBonus;

    const actualConsumed = cost - remaining;

    if (remaining > 0) {
      console.warn(
        `[Credits] Insufficient credits: needed ${cost}, consumed ${actualConsumed}, shortfall ${remaining}`,
      );
    }

    // Calculate balance snapshots
    const effectiveOriginalDaily = needsDailyReset(userData.dailyCreditsResetAt)
      ? 0
      : (userData.dailyCredits ?? 0);
    const balanceBefore =
      effectiveOriginalDaily + (userData.subscriptionCredits ?? 0) + (userData.bonusCredits ?? 0);
    const balanceAfter = dailyCredits + subscriptionCredits + bonusCredits;

    // Update database
    await tx
      .update(user)
      .set({
        dailyCredits,
        subscriptionCredits,
        bonusCredits,
        ...(needsDailyReset(userData.dailyCreditsResetAt)
          ? { dailyCreditsResetAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Create credit record
    if (actualConsumed > 0) {
      await tx.insert(creditRecords).values({
        userId,
        type: "generation",
        amount: -actualConsumed,
        balanceBefore,
        balanceAfter,
        creditPool: "mixed",
        metadata: metadata || {},
      });
    }

    return {
      success: true,
      creditsConsumed: actualConsumed,
      balance: buildCreditsBalance(
        dailyCredits,
        subscriptionCredits,
        subscriptionLimit,
        bonusCredits,
        userData.subscriptionExpiresAt,
      ),
    };
  });
}

/**
 * Add bonus credits (from purchases, referrals, etc.)
 * Bonus credits never expire
 */
export async function addBonusCredits(userId: string, credits: number): Promise<void> {
  await db
    .update(user)
    .set({
      bonusCredits: sql`COALESCE(${user.bonusCredits}, 0) + ${credits}`,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}

/**
 * Reset subscription credits (called on subscription purchase/renewal)
 */
export async function resetSubscriptionCredits(
  userId: string,
  tier: SubscriptionTier,
  expiresAt: Date,
): Promise<void> {
  const creditsAmount = getSubscriptionCreditsLimit(tier, expiresAt);

  await db
    .update(user)
    .set({
      subscriptionCredits: creditsAmount,
      subscriptionCreditsResetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}

// Re-export admin credit operations
export { grantCredits } from "./credits-admin";
