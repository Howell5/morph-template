import { z } from "zod";

/**
 * Task status enum
 */
export const taskStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/**
 * Schema for submitting a new task
 */
export const submitTaskSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

export type SubmitTask = z.infer<typeof submitTaskSchema>;

/**
 * Schema for querying a task by ID
 */
export const taskIdSchema = z.object({
  id: z.string().uuid(),
});

export type TaskId = z.infer<typeof taskIdSchema>;

/**
 * Schema for listing tasks with pagination and optional filters
 */
export const listTasksSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  status: taskStatusSchema.optional(),
  type: z.string().optional(),
});

export type ListTasks = z.infer<typeof listTasksSchema>;
