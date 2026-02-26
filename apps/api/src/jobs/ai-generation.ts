import { eq } from "drizzle-orm";
import type { Job, PgBoss } from "pg-boss";
import { db } from "../db";
import { aiTasks } from "../db/schema";
import { getOpenRouter } from "../lib/ai";

/**
 * Payload matching the fields stored in aiTasks + enqueued from tasks route
 */
export interface AiGenerationPayload {
  taskId: string;
  userId: string;
  provider: string;
  type: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  duration?: number;
  mode?: string;
  imageUrl?: string;
}

/**
 * Process a single AI generation job via OpenRouter
 *
 * Supports:
 * - text-to-image: generates image via OpenRouter with image modality
 * - text-to-video / image-to-video: placeholder for future provider integration
 */
async function processJob(job: Job<AiGenerationPayload>) {
  const { taskId, type, model, prompt, negativePrompt } = job.data;
  const startTime = Date.now();

  console.log(`[Job:ai-generation] Processing ${type} task ${taskId} (${model})`);

  await db.update(aiTasks).set({ status: "processing" }).where(eq(aiTasks.id, taskId));

  try {
    let resultUrl: string | undefined;

    if (type === "text-to-image") {
      resultUrl = await generateImage(model, prompt, negativePrompt);
    } else {
      // text-to-video / image-to-video: not yet implemented via OpenRouter
      // When integrating a video provider, add the logic here and follow
      // the same pattern: call API → poll if async → get result URL
      throw new Error(`Task type "${type}" is not yet implemented`);
    }

    const durationMs = Date.now() - startTime;

    await db
      .update(aiTasks)
      .set({
        status: "completed",
        resultUrl,
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, taskId));

    console.log(`[Job:ai-generation] Task ${taskId} completed in ${durationMs}ms`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startTime;

    console.error(`[Job:ai-generation] Task ${taskId} failed: ${message}`);

    await db
      .update(aiTasks)
      .set({
        status: "failed",
        error: message,
        durationMs,
      })
      .where(eq(aiTasks.id, taskId));

    throw error; // pg-boss will retry
  }
}

/**
 * Generate an image via OpenRouter and return a data URL or content URL
 */
async function generateImage(
  model: string,
  prompt: string,
  negativePrompt?: string,
): Promise<string> {
  const openrouter = getOpenRouter();

  const fullPrompt = negativePrompt ? `${prompt}\n\nNegative: ${negativePrompt}` : prompt;

  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model,
      messages: [{ role: "user", content: fullPrompt }],
      modalities: ["image", "text"],
    },
  });

  // Extract image URL from response
  // OpenRouter returns images as base64 data URLs in message content
  const content = (response as Record<string, unknown>).choices;
  if (Array.isArray(content) && content.length > 0) {
    const message = content[0]?.message;
    if (message?.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          return part.image_url.url;
        }
      }
    }
    // Fallback: content might be a string URL
    if (typeof message?.content === "string" && message.content.startsWith("http")) {
      return message.content;
    }
  }

  throw new Error("No image found in AI response");
}

/**
 * Register the AI generation job handler
 */
export function registerAiGenerationJob(boss: PgBoss) {
  boss.work<AiGenerationPayload>("ai-generation", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await processJob(job);
    }
  });
}
