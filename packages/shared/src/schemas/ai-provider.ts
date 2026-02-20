import { z } from "zod";

/**
 * Supported AI providers
 */
export const aiProviderSchema = z.enum(["kling", "hailuo", "seedance", "nano", "banana"]);
export type AIProvider = z.infer<typeof aiProviderSchema>;

/**
 * Supported AI task types
 */
export const aiTaskTypeSchema = z.enum(["text-to-video", "image-to-video", "text-to-image"]);
export type AITaskType = z.infer<typeof aiTaskTypeSchema>;

/**
 * Unified task status across all providers
 */
export const aiTaskStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export type AITaskStatus = z.infer<typeof aiTaskStatusSchema>;

/**
 * Supported aspect ratios
 */
export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"]);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

/**
 * Generation mode (standard vs professional)
 */
export const generationModeSchema = z.enum(["std", "pro"]);
export type GenerationMode = z.infer<typeof generationModeSchema>;
