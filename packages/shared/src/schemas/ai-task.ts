import { z } from "zod";
import {
  aiProviderSchema,
  aiTaskStatusSchema,
  aiTaskTypeSchema,
  aspectRatioSchema,
  generationModeSchema,
} from "./ai-provider";

/**
 * Schema for creating an AI generation task
 */
export const createAITaskSchema = z.object({
  provider: aiProviderSchema,
  type: aiTaskTypeSchema,
  model: z.string().min(1),
  prompt: z.string().min(1).max(2500),
  negativePrompt: z.string().max(2500).optional(),
  aspectRatio: aspectRatioSchema.default("16:9"),
  duration: z.coerce.number().int().min(5).max(10).optional(),
  mode: generationModeSchema.default("std"),
  imageUrl: z.string().url().optional(),
});

export type CreateAITask = z.infer<typeof createAITaskSchema>;

/**
 * Schema for querying a single AI task by ID
 */
export const aiTaskIdSchema = z.object({
  taskId: z.string().uuid(),
});

export type AITaskId = z.infer<typeof aiTaskIdSchema>;

/**
 * Schema for listing AI tasks with pagination and optional filters
 */
export const listAITasksSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  status: aiTaskStatusSchema.optional(),
  type: aiTaskTypeSchema.optional(),
  provider: aiProviderSchema.optional(),
});

export type ListAITasks = z.infer<typeof listAITasksSchema>;
