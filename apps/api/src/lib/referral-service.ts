/**
 * Referral Service
 *
 * Handles referral code application with anti-fraud measures:
 * - IP rate limiting (5/IP/day)
 * - Monthly credit cap (300/month)
 * - Self-referral prevention
 */

import { REFERRAL_CONFIG } from "@repo/shared";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { creditRecords, referrals, user } from "../db/schema";
import { getClientIp } from "./rate-limit";

export interface ApplyReferralResult {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * Apply a referral code after signup
 */
export async function applyReferralCode(
  referredUserId: string,
  referrerUserId: string,
  headers: Headers,
): Promise<ApplyReferralResult> {
  // Prevent self-referral
  if (referredUserId === referrerUserId) {
    return { success: false, error: "Cannot refer yourself", code: "SELF_REFERRAL" };
  }

  return db.transaction(async (tx) => {
    // Check if referral already exists
    const existing = await tx.query.referrals.findFirst({
      where: eq(referrals.referredId, referredUserId),
    });

    if (existing) {
      return { success: false, error: "Referral already applied", code: "ALREADY_APPLIED" };
    }

    // Check referrer exists
    const referrer = await tx.query.user.findFirst({
      where: eq(user.id, referrerUserId),
      columns: { id: true, referralCreditsThisMonth: true },
    });

    if (!referrer) {
      return { success: false, error: "Referrer not found", code: "REFERRER_NOT_FOUND" };
    }

    // Check monthly limit
    if ((referrer.referralCreditsThisMonth ?? 0) >= REFERRAL_CONFIG.MONTHLY_LIMIT) {
      return { success: false, error: "Referrer reached monthly limit", code: "MONTHLY_LIMIT" };
    }

    // Anti-fraud: IP check
    const ip = getClientIp(headers);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const ipReferrals = await tx
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(and(eq(referrals.ipAddress, ip), gte(referrals.createdAt, today)));

    if (Number(ipReferrals[0]?.count ?? 0) >= REFERRAL_CONFIG.MAX_REFERRALS_PER_IP_PER_DAY) {
      return { success: false, error: "Too many referrals from this IP", code: "IP_LIMIT" };
    }

    // Create referral record
    await tx.insert(referrals).values({
      referrerId: referrerUserId,
      referredId: referredUserId,
      referrerCredits: REFERRAL_CONFIG.REFERRER_REWARD,
      referredCredits: REFERRAL_CONFIG.REFERRED_REWARD,
      status: "completed",
      ipAddress: ip,
      userAgent: headers.get("user-agent") ?? undefined,
    });

    // Award credits to both parties (bonus credits, never expire)
    await tx
      .update(user)
      .set({
        bonusCredits: sql`${user.bonusCredits} + ${REFERRAL_CONFIG.REFERRER_REWARD}`,
        referralCreditsThisMonth: sql`${user.referralCreditsThisMonth} + ${REFERRAL_CONFIG.REFERRER_REWARD}`,
        totalReferralCredits: sql`${user.totalReferralCredits} + ${REFERRAL_CONFIG.REFERRER_REWARD}`,
        totalReferrals: sql`${user.totalReferrals} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, referrerUserId));

    await tx
      .update(user)
      .set({
        bonusCredits: sql`${user.bonusCredits} + ${REFERRAL_CONFIG.REFERRED_REWARD}`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, referredUserId));

    // Create credit records for both
    const referrerData = await tx.query.user.findFirst({
      where: eq(user.id, referrerUserId),
      columns: { dailyCredits: true, subscriptionCredits: true, bonusCredits: true },
    });
    const referredData = await tx.query.user.findFirst({
      where: eq(user.id, referredUserId),
      columns: { dailyCredits: true, subscriptionCredits: true, bonusCredits: true },
    });

    const referrerTotal =
      (referrerData?.dailyCredits ?? 0) +
      (referrerData?.subscriptionCredits ?? 0) +
      (referrerData?.bonusCredits ?? 0);
    const referredTotal =
      (referredData?.dailyCredits ?? 0) +
      (referredData?.subscriptionCredits ?? 0) +
      (referredData?.bonusCredits ?? 0);

    await tx.insert(creditRecords).values([
      {
        userId: referrerUserId,
        type: "referral_inviter",
        amount: REFERRAL_CONFIG.REFERRER_REWARD,
        balanceBefore: referrerTotal - REFERRAL_CONFIG.REFERRER_REWARD,
        balanceAfter: referrerTotal,
        creditPool: "bonus",
        metadata: { referredUserId },
      },
      {
        userId: referredUserId,
        type: "referral_invitee",
        amount: REFERRAL_CONFIG.REFERRED_REWARD,
        balanceBefore: referredTotal - REFERRAL_CONFIG.REFERRED_REWARD,
        balanceAfter: referredTotal,
        creditPool: "bonus",
        metadata: { referrerUserId },
      },
    ]);

    return { success: true };
  });
}
