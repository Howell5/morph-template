import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { aiTasks } from "../db/schema";
import { klingProvider } from "../providers/kling";
import type { AIProvider, CreateTaskParams } from "../providers/types";
import type { AITask, IAIService, ListTasksQuery } from "./types";

// Poll interval and max attempts for background task polling
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 360; // 30 minutes at 5s intervals

/**
 * AI Service implementation
 *
 * Manages provider registry, task persistence, credit management,
 * and background polling for async task completion.
 */
export class AIService implements IAIService {
  private providers: Map<string, AIProvider>;

  constructor() {
    this.providers = new Map();
    this.registerProvider(klingProvider);
  }

  private registerProvider(provider: AIProvider) {
    this.providers.set(provider.name, provider);
  }

  isConfigured(): boolean {
    for (const provider of this.providers.values()) {
      if (provider.isConfigured()) return true;
    }
    return false;
  }

  getProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, p]) => p.isConfigured())
      .map(([name]) => name);
  }

  getModels(provider?: string) {
    const models = [];
    for (const [name, p] of this.providers.entries()) {
      if (provider && name !== provider) continue;
      if (p.isConfigured()) {
        models.push(...p.getAvailableModels());
      }
    }
    return models;
  }

  async createTask(userId: string, params: CreateTaskParams): Promise<AITask> {
    // Find the correct provider for the requested model
    const targetProvider = this.findProviderForModel(params.model);
    if (!targetProvider) {
      throw new Error(`No provider found for model: ${params.model}`);
    }
    if (!targetProvider.isConfigured()) {
      throw new Error(`Provider ${targetProvider.name} is not configured`);
    }

    // Create DB record first
    const [task] = await db
      .insert(aiTasks)
      .values({
        userId,
        provider: targetProvider.name,
        type: params.type,
        model: params.model,
        status: "pending",
        prompt: params.prompt,
        negativePrompt: params.negativePrompt ?? null,
        aspectRatio: params.aspectRatio ?? "16:9",
        duration: params.duration ?? null,
        mode: params.mode ?? "std",
        inputImageUrl: params.imageUrl ?? null,
      })
      .returning();

    // Submit to provider
    try {
      const providerResult = await targetProvider.createTask(params);

      // Update with provider task ID
      const [updatedTask] = await db
        .update(aiTasks)
        .set({
          providerTaskId: providerResult.providerTaskId,
          status: providerResult.status,
          ...(providerResult.error && { error: providerResult.error }),
        })
        .where(eq(aiTasks.id, task.id))
        .returning();

      // Start background polling if task is not already done
      if (providerResult.status !== "completed" && providerResult.status !== "failed") {
        this.pollTaskCompletion(
          updatedTask.id,
          targetProvider,
          providerResult.providerTaskId,
          params.type,
        );
      }

      return updatedTask as AITask;
    } catch (error) {
      // Mark task as failed if provider submission fails
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const [failedTask] = await db
        .update(aiTasks)
        .set({ status: "failed", error: errorMsg })
        .where(eq(aiTasks.id, task.id))
        .returning();

      return failedTask as AITask;
    }
  }

  async queryTask(taskId: string, userId: string): Promise<AITask> {
    const task = await db.query.aiTasks.findFirst({
      where: and(eq(aiTasks.id, taskId), eq(aiTasks.userId, userId)),
    });

    if (!task) {
      throw new Error("Task not found");
    }

    return task as AITask;
  }

  async listTasks(
    userId: string,
    query: ListTasksQuery,
  ): Promise<{ tasks: AITask[]; total: number }> {
    const { page, limit, status, type, provider } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(aiTasks.userId, userId)];
    if (status) conditions.push(eq(aiTasks.status, status));
    if (type) conditions.push(eq(aiTasks.type, type));
    if (provider) conditions.push(eq(aiTasks.provider, provider));

    const where = and(...conditions);

    const [tasks, [totalResult]] = await Promise.all([
      db.query.aiTasks.findMany({
        where,
        limit,
        offset,
        orderBy: [desc(aiTasks.createdAt)],
      }),
      db.select({ count: count() }).from(aiTasks).where(where),
    ]);

    return {
      tasks: tasks as AITask[],
      total: totalResult.count,
    };
  }

  /**
   * Find the provider that supports a given model
   */
  private findProviderForModel(modelId: string): AIProvider | undefined {
    for (const provider of this.providers.values()) {
      const models = provider.getAvailableModels();
      if (models.some((m) => m.id === modelId)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Background polling for task completion
   * Polls provider until task reaches terminal state (completed/failed)
   */
  private pollTaskCompletion(
    taskId: string,
    provider: AIProvider,
    providerTaskId: string,
    type: string,
  ) {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      if (attempts > MAX_POLL_ATTEMPTS) {
        await db
          .update(aiTasks)
          .set({ status: "failed", error: "Task timed out after 30 minutes" })
          .where(eq(aiTasks.id, taskId));
        return;
      }

      try {
        const result = await provider.queryTask(providerTaskId, type);

        if (result.status === "completed") {
          const startTime = await db.query.aiTasks.findFirst({
            where: eq(aiTasks.id, taskId),
            columns: { createdAt: true },
          });

          await db
            .update(aiTasks)
            .set({
              status: "completed",
              resultUrl: result.resultUrl,
              completedAt: new Date(),
              durationMs: startTime ? Date.now() - startTime.createdAt.getTime() : null,
            })
            .where(eq(aiTasks.id, taskId));
          return;
        }

        if (result.status === "failed") {
          await db
            .update(aiTasks)
            .set({
              status: "failed",
              error: result.error || "Task failed",
              completedAt: new Date(),
            })
            .where(eq(aiTasks.id, taskId));
          return;
        }

        // Still processing, update status and continue polling
        await db.update(aiTasks).set({ status: result.status }).where(eq(aiTasks.id, taskId));

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        console.error(`[AIService] Poll error for task ${taskId}:`, error);
        // Continue polling on transient errors
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Start polling after initial delay
    setTimeout(poll, POLL_INTERVAL_MS);
  }
}
