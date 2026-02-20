import { zValidator } from "@hono/zod-validator";
import { aiTaskIdSchema, listAITasksSchema } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "../../auth";
import { errors, ok } from "../../lib/response";

const tasksRoute = new Hono()
  /**
   * GET /
   * List user's AI tasks with pagination and filters
   */
  .get("/", zValidator("query", listAITasksSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const query = c.req.valid("query");

    try {
      const result = await c.var.aiService.listTasks(session.user.id, query);
      return ok(c, {
        tasks: result.tasks,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
        },
      });
    } catch (error) {
      console.error("[AI Tasks] List error:", error);
      return errors.internal(c);
    }
  })

  /**
   * GET /:taskId
   * Get a single AI task by ID (ownership check)
   */
  .get("/:taskId", zValidator("param", aiTaskIdSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { taskId } = c.req.valid("param");

    try {
      const task = await c.var.aiService.queryTask(taskId, session.user.id);
      return ok(c, task);
    } catch (error) {
      if (error instanceof Error && error.message === "Task not found") {
        return errors.notFound(c, "Task not found");
      }
      console.error("[AI Tasks] Query error:", error);
      return errors.internal(c);
    }
  });

export default tasksRoute;
