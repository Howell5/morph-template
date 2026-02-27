import { z } from "zod";

/**
 * Schema for applying a referral code
 */
export const applyReferralSchema = z.object({
  code: z.string().min(1),
});

export type ApplyReferral = z.infer<typeof applyReferralSchema>;
