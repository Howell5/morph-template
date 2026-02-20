import { zValidator } from "@hono/zod-validator";
import { createAITaskSchema } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "../../auth";
import {
  AI_GENERATION_LIMIT,
  checkRateLimit,
  getAIGenerationRateLimitKey,
} from "../../lib/rate-limit";
import { errors, ok } from "../../lib/response";

const generateRoute = new Hono()
  /**
   * POST /
   * Create an AI generation task
   * Requires authentication and rate limiting
   */
  .post("/", zValidator("json", createAITaskSchema), async (c) => {
    const aiService = c.var.aiService;

    // Check if any provider is configured
    if (!aiService.isConfigured()) {
      return errors.serviceUnavailable(
        c,
        "AI generation is not configured. No providers available.",
      );
    }

    // Authentication check
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    // Rate limit check
    const rateLimit = checkRateLimit(
      getAIGenerationRateLimitKey(session.user.id),
      AI_GENERATION_LIMIT,
    );
    if (rateLimit.limited) {
      return errors.tooManyRequests(c);
    }

    const params = c.req.valid("json");

    try {
      const task = await aiService.createTask(session.user.id, params);
      return ok(c, task, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create AI task";
      console.error("[AI Generate] Error:", message);
      return errors.internal(c, message);
    }
  });

export default generateRoute;
