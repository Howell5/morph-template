import { zValidator } from "@hono/zod-validator";
import { submitFeedbackSchema } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { feedback } from "../db/schema";
import { FEEDBACK_LIMIT, checkRateLimit, getClientIp } from "../lib/rate-limit";
import { errors, ok } from "../lib/response";

const feedbackRoute = new Hono()
  /**
   * POST /feedback
   * Submit user feedback (rate limited)
   */
  .post("/", zValidator("json", submitFeedbackSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return errors.unauthorized(c);

    // Rate limit: 5 per user per hour
    const ip = getClientIp(c.req.raw.headers);
    const userRateLimit = checkRateLimit(`feedback:user:${session.user.id}`, FEEDBACK_LIMIT);
    const ipRateLimit = checkRateLimit(`feedback:ip:${ip}`, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
    });

    if (userRateLimit.limited || ipRateLimit.limited) {
      return errors.tooManyRequests(c);
    }

    const data = c.req.valid("json");

    const [item] = await db
      .insert(feedback)
      .values({
        userId: session.user.id,
        type: data.type,
        title: data.title,
        description: data.description,
        screenshotUrl: data.screenshotUrl,
        status: "open",
      })
      .returning();

    return ok(c, { feedback: item }, 201);
  });

export default feedbackRoute;
