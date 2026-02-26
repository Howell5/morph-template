import { zValidator } from "@hono/zod-validator";
import { createAITaskSchema, listTasksQuerySchema, taskIdParamSchema } from "@repo/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { aiTasks } from "../db/schema";
import { isAIConfigured } from "../lib/ai";
import { getQueue } from "../lib/queue";
import {
  AI_GENERATION_LIMIT,
  checkRateLimit,
  getAIGenerationRateLimitKey,
} from "../lib/rate-limit";
import { errors, ok } from "../lib/response";

const tasksRoute = new Hono()
  /**
   * Submit a new AI generation task
   * Creates a DB record and enqueues the job for background processing
   */
  .post("/", zValidator("json", createAITaskSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    if (!isAIConfigured()) {
      return errors.serviceUnavailable(c, "AI is not configured");
    }

    const rateLimit = checkRateLimit(
      getAIGenerationRateLimitKey(session.user.id),
      AI_GENERATION_LIMIT,
    );
    if (rateLimit.limited) {
      return errors.tooManyRequests(c);
    }

    const data = c.req.valid("json");

    // Create task record
    const [task] = await db
      .insert(aiTasks)
      .values({
        userId: session.user.id,
        provider: data.provider,
        type: data.type,
        model: data.model,
        prompt: data.prompt,
        negativePrompt: data.negativePrompt,
        aspectRatio: data.aspectRatio,
        duration: data.duration,
        mode: data.mode,
        inputImageUrl: data.imageUrl,
        status: "pending",
      })
      .returning();

    // Enqueue the job
    const boss = getQueue();
    await boss.send("ai-generation", {
      taskId: task.id,
      userId: session.user.id,
      provider: data.provider,
      type: data.type,
      model: data.model,
      prompt: data.prompt,
      negativePrompt: data.negativePrompt,
      aspectRatio: data.aspectRatio,
      duration: data.duration,
      mode: data.mode,
      imageUrl: data.imageUrl,
    });

    return ok(c, { task }, 201);
  })

  /**
   * Get a single task by ID
   */
  .get("/:id", zValidator("param", taskIdParamSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { id } = c.req.valid("param");

    const task = await db.query.aiTasks.findFirst({
      where: and(eq(aiTasks.id, id), eq(aiTasks.userId, session.user.id)),
    });

    if (!task) {
      return errors.notFound(c, "Task not found");
    }

    return ok(c, { task });
  })

  /**
   * List tasks with pagination and optional filters
   */
  .get("/", zValidator("query", listTasksQuerySchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { page, limit, status, type } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [eq(aiTasks.userId, session.user.id)];
    if (status) {
      conditions.push(eq(aiTasks.status, status));
    }
    if (type) {
      conditions.push(eq(aiTasks.type, type));
    }

    const where = and(...conditions);

    const [tasks, countResult] = await Promise.all([
      db.query.aiTasks.findMany({
        where,
        orderBy: [desc(aiTasks.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(aiTasks).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;

    return ok(c, {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

export default tasksRoute;
