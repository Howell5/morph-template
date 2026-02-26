import { z } from "zod";
import { aiTaskStatusSchema } from "./ai-provider";

/**
 * Schema for querying a task by ID (path param)
 */
export const taskIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type TaskIdParam = z.infer<typeof taskIdParamSchema>;

/**
 * Schema for listing tasks with pagination and optional filters
 */
export const listTasksQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  status: aiTaskStatusSchema.optional(),
  type: z.string().optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
