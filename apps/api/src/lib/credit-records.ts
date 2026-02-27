/**
 * Credit Records Service
 *
 * Provides audit trail for all credit changes:
 * - Signup bonus
 * - Referral rewards (inviter & invitee)
 * - Daily login rewards
 * - AI generation consumption
 * - Admin grants
 * - Credit purchases
 * - Subscription resets
 */

import type { CreditPool, CreditRecordType } from "@repo/shared";
import { db } from "../db";
import { creditRecords } from "../db/schema";

// ============= Types =============

export interface CreditRecordMetadata extends Record<string, unknown> {
  // Referral-related
  referralId?: string;
  referrerId?: string;
  referredUserId?: string;
  // Generation-related
  messageId?: string;
  projectId?: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  // Admin grant
  adminId?: string;
  adminEmail?: string;
  reason?: string;
  // Purchase
  orderId?: string;
  packageId?: string;
  // Subscription
  tier?: string;
  previousCredits?: number;
}

export interface CreateCreditRecordParams {
  userId: string;
  type: CreditRecordType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  creditPool: CreditPool;
  metadata?: CreditRecordMetadata;
}

// ============= Helper Functions =============

/**
 * Determine the credit pool based on record type
 */
export function getPoolForType(type: CreditRecordType): CreditPool {
  switch (type) {
    case "signup_bonus":
    case "referral_inviter":
    case "referral_invitee":
    case "admin_grant":
    case "purchase":
      return "bonus";
    case "daily_login":
      return "daily";
    case "subscription_reset":
      return "subscription";
    case "generation":
      return "mixed";
    default:
      return "bonus";
  }
}

// ============= Core Functions =============

/**
 * Create a credit record entry
 */
export async function createCreditRecord(params: CreateCreditRecordParams): Promise<string> {
  const [record] = await db
    .insert(creditRecords)
    .values({
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      creditPool: params.creditPool,
      metadata: params.metadata || {},
    })
    .returning({ id: creditRecords.id });

  return record.id;
}

/**
 * Create a credit record within a transaction
 */
export async function createCreditRecordTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: CreateCreditRecordParams,
): Promise<string> {
  const [record] = await tx
    .insert(creditRecords)
    .values({
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      creditPool: params.creditPool,
      metadata: params.metadata || {},
    })
    .returning({ id: creditRecords.id });

  return record.id;
}
