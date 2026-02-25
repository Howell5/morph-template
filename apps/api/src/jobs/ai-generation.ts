import { eq } from "drizzle-orm";
import type { Job, PgBoss } from "pg-boss";
import { db } from "../db";
import { aiTasks } from "../db/schema";

/**
 * Payload for AI generation jobs
 */
export interface AiGenerationPayload {
  taskId: string;
  userId: string;
  provider: string;
  type: string;
  model: string;
  prompt: string;
}

/**
 * Process a single AI generation job
 */
async function processJob(job: Job<AiGenerationPayload>) {
  const { taskId, provider, model } = job.data;
  console.log(`[Job:ai-generation] Processing task ${taskId} (${provider}/${model})`);

  // Mark as processing
  await db.update(aiTasks).set({ status: "processing" }).where(eq(aiTasks.id, taskId));

  try {
    // TODO: Replace with actual AI provider call
    // Example: const result = await callProvider(provider, model, prompt);
    //
    // When implementing, you would:
    // 1. Call the external AI provider API
    // 2. Poll for completion if the provider is async
    // 3. Download the result and optionally upload to R2
    // 4. Update the task with the result URL

    console.log(`[Job:ai-generation] Task ${taskId} completed`);

    await db
      .update(aiTasks)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, taskId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Job:ai-generation] Task ${taskId} failed:`, message);

    await db
      .update(aiTasks)
      .set({
        status: "failed",
        error: message,
      })
      .where(eq(aiTasks.id, taskId));

    // Re-throw so pg-boss retries the job
    throw error;
  }
}

/**
 * Register the AI generation job handler
 *
 * pg-boss v12 delivers jobs as an array (batchSize controls how many).
 * We process each job sequentially within a batch.
 */
export function registerAiGenerationJob(boss: PgBoss) {
  boss.work<AiGenerationPayload>("ai-generation", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await processJob(job);
    }
  });
}
