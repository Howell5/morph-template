import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  model: z.string().default("moonshotai/kimi-k2.5"),
  modalities: z.array(z.enum(["text", "image"])).default(["text"]),
  imageConfig: z.record(z.union([z.string(), z.number(), z.array(z.any())])).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
