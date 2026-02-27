import { z } from "zod";

/**
 * Feedback type enum
 */
export const feedbackTypeSchema = z.enum(["bug", "feature", "general"]);
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

/**
 * Feedback status enum
 */
export const feedbackStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

/**
 * Schema for submitting feedback
 */
export const submitFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  screenshotUrl: z.string().url().optional(),
});

export type SubmitFeedback = z.infer<typeof submitFeedbackSchema>;

/**
 * Feedback type labels for display
 */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General Feedback",
};
