import { zValidator } from "@hono/zod-validator";
import { listTasksSchema, submitTaskSchema, taskIdSchema } from "@repo/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { aiTasks } from "../db/schema";
import { getQueue } from "../lib/queue";
import {
  AI_GENERATION_LIMIT,
  checkRateLimit,
  getAIGenerationRateLimitKey,
} from "../lib/rate-limit";
import { errors, ok } from "../lib/response";

const tasksRoute = new Hono()
  /**
   * Submit a new task
   * Validates input, creates a DB record, and enqueues the job
   */
  .post("/", zValidator("json", submitTaskSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    // Rate limit
    const rateLimit = checkRateLimit(
      getAIGenerationRateLimitKey(session.user.id),
      AI_GENERATION_LIMIT,
    );
    if (rateLimit.limited) {
      return errors.tooManyRequests(c);
    }

    const { type, payload } = c.req.valid("json");

    // Create task record in database
    const [task] = await db
      .insert(aiTasks)
      .values({
        userId: session.user.id,
        provider: (payload.provider as string) || "default",
        type,
        model: (payload.model as string) || "default",
        prompt: (payload.prompt as string) || "",
        status: "pending",
      })
      .returning();

    // Enqueue the job
    const boss = getQueue();
    await boss.send(type, {
      taskId: task.id,
      userId: session.user.id,
      ...payload,
    });

    return ok(c, { task }, 201);
  })

  /**
   * Get a single task by ID
   * Only returns tasks owned by the authenticated user
   */
  .get("/:id", zValidator("param", taskIdSchema), async (c) => {
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
  .get("/", zValidator("query", listTasksSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { page, limit, status, type } = c.req.valid("query");
    const offset = (page - 1) * limit;

    // Build where conditions
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
