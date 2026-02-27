import { z } from "zod";
import { paginationSchema } from "./common";
import { creditRecordTypeSchema } from "./credit-record";

/**
 * Schema for granting credits to a user
 */
export const grantCreditsSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().min(1).max(100000),
  reason: z.string().min(1).max(500),
});

export type GrantCredits = z.infer<typeof grantCreditsSchema>;

/**
 * Schema for querying admin credit records
 */
export const adminCreditRecordsQuerySchema = paginationSchema.extend({
  userId: z.string().optional(),
  type: creditRecordTypeSchema.optional(),
});

export type AdminCreditRecordsQuery = z.infer<typeof adminCreditRecordsQuerySchema>;

/**
 * Schema for searching users
 */
export const searchUsersSchema = z.object({
  email: z.string().min(1),
});

export type SearchUsers = z.infer<typeof searchUsersSchema>;
