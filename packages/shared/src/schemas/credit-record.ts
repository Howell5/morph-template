import { z } from "zod";
import { paginationSchema } from "./common";

/**
 * Credit record types
 */
export const creditRecordTypeSchema = z.enum([
  "signup_bonus",
  "daily_login",
  "generation",
  "purchase",
  "subscription_reset",
  "admin_grant",
  "referral_inviter",
  "referral_invitee",
]);

export type CreditRecordType = z.infer<typeof creditRecordTypeSchema>;

/**
 * Credit pool types
 */
export const creditPoolSchema = z.enum(["daily", "subscription", "bonus", "mixed"]);
export type CreditPool = z.infer<typeof creditPoolSchema>;

/**
 * Schema for querying credit records
 */
export const creditRecordsQuerySchema = paginationSchema.extend({
  type: creditRecordTypeSchema.optional(),
});

export type CreditRecordsQuery = z.infer<typeof creditRecordsQuerySchema>;
