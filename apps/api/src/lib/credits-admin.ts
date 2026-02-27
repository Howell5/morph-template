/**
 * Credits Admin Operations
 *
 * Admin-specific credit operations extracted from credits-service.ts
 * to keep file sizes manageable.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { creditRecords, user } from "../db/schema";

/**
 * Grant credits as admin
 * Credits are added to bonusCredits (permanent)
 */
export async function grantCredits(params: {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  amount: number;
  reason: string;
}): Promise<
  | {
      success: true;
      balanceAfter: number;
      targetUser: { id: string; email: string; name: string };
    }
  | { success: false; error: string }
> {
  const { adminId, adminEmail, targetUserId, amount, reason } = params;

  if (amount <= 0 || amount > 100000) {
    return { success: false, error: "Amount must be between 1 and 100000" };
  }

  return db.transaction(async (tx) => {
    const targetUser = await tx.query.user.findFirst({
      where: eq(user.id, targetUserId),
      columns: {
        id: true,
        email: true,
        name: true,
        bonusCredits: true,
        dailyCredits: true,
        subscriptionCredits: true,
      },
    });

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const currentBonus = targetUser.bonusCredits ?? 0;
    const newBonus = currentBonus + amount;

    await tx
      .update(user)
      .set({ bonusCredits: newBonus, updatedAt: new Date() })
      .where(eq(user.id, targetUserId));

    const totalBalanceBefore =
      currentBonus + (targetUser.dailyCredits ?? 0) + (targetUser.subscriptionCredits ?? 0);
    const totalBalanceAfter = totalBalanceBefore + amount;

    await tx.insert(creditRecords).values({
      userId: targetUserId,
      type: "admin_grant",
      amount,
      balanceBefore: totalBalanceBefore,
      balanceAfter: totalBalanceAfter,
      creditPool: "bonus",
      metadata: { adminId, adminEmail, reason },
    });

    return {
      success: true,
      balanceAfter: newBonus,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
    };
  });
}
