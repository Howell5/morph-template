import { zValidator } from "@hono/zod-validator";
import { adminCreditRecordsQuerySchema, grantCreditsSchema, searchUsersSchema } from "@repo/shared";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { creditRecords, feedback, user } from "../db/schema";
import { getClientIpForAudit, logAdminAction } from "../lib/audit-log";
import { grantCredits } from "../lib/credits-service";
import { errors, ok } from "../lib/response";

/**
 * Check if user is admin
 */
async function requireAdmin(c: {
  req: { raw: { headers: Headers } };
}): Promise<
  | { authorized: true; session: { user: { id: string; email: string; name: string } } }
  | { authorized: false }
> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return { authorized: false };

  const userData = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { role: true },
  });

  if (userData?.role !== "admin") return { authorized: false };

  return { authorized: true, session };
}

const adminRoute = new Hono()
  /**
   * GET /admin/check
   * Check if current user is admin
   */
  .get("/check", async (c) => {
    const result = await requireAdmin(c);
    return ok(c, { isAdmin: result.authorized });
  })

  /**
   * GET /admin/users/search
   * Search users by email
   */
  .get("/users/search", zValidator("query", searchUsersSchema), async (c) => {
    const result = await requireAdmin(c);
    if (!result.authorized) return errors.forbidden(c);

    const { email } = c.req.valid("query");

    const users = await db.query.user.findMany({
      where: like(user.email, `%${email}%`),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionTier: true,
        dailyCredits: true,
        subscriptionCredits: true,
        bonusCredits: true,
        createdAt: true,
      },
      limit: 20,
    });

    logAdminAction({
      action: "search_users",
      adminId: result.session.user.id,
      adminEmail: result.session.user.email,
      ipAddress: getClientIpForAudit(c.req.raw.headers),
      details: { query: email, resultCount: users.length },
    });

    return ok(c, { users });
  })

  /**
   * POST /admin/credits/grant
   * Grant bonus credits to a user
   */
  .post("/credits/grant", zValidator("json", grantCreditsSchema), async (c) => {
    const result = await requireAdmin(c);
    if (!result.authorized) return errors.forbidden(c);

    const { userId, amount, reason } = c.req.valid("json");

    const grantResult = await grantCredits({
      adminId: result.session.user.id,
      adminEmail: result.session.user.email,
      targetUserId: userId,
      amount,
      reason,
    });

    if (!grantResult.success) {
      return errors.badRequest(c, grantResult.error);
    }

    logAdminAction({
      action: "grant_credits",
      adminId: result.session.user.id,
      adminEmail: result.session.user.email,
      targetId: userId,
      targetType: "user",
      ipAddress: getClientIpForAudit(c.req.raw.headers),
      details: { amount, reason },
    });

    return ok(c, grantResult);
  })

  /**
   * GET /admin/credits/records
   * View credit records with filtering
   */
  .get("/credits/records", zValidator("query", adminCreditRecordsQuerySchema), async (c) => {
    const result = await requireAdmin(c);
    if (!result.authorized) return errors.forbidden(c);

    const { page, limit, userId, type } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [];
    if (userId) conditions.push(eq(creditRecords.userId, userId));
    if (type) conditions.push(eq(creditRecords.type, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [records, countResult] = await Promise.all([
      db.query.creditRecords.findMany({
        where: whereClause,
        orderBy: [desc(creditRecords.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(creditRecords).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return ok(c, {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })

  /**
   * GET /admin/feedback
   * List feedback with filtering
   */
  .get("/feedback", async (c) => {
    const result = await requireAdmin(c);
    if (!result.authorized) return errors.forbidden(c);

    const status = c.req.query("status");
    const type = c.req.query("type");

    const conditions = [];
    if (status) conditions.push(eq(feedback.status, status));
    if (type) conditions.push(eq(feedback.type, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.query.feedback.findMany({
      where: whereClause,
      orderBy: [desc(feedback.createdAt)],
      limit: 50,
      with: {
        user: { columns: { id: true, name: true, email: true } },
      },
    });

    // Summary counts
    const [summary] = await db
      .select({
        open: sql<number>`count(*) filter (where ${feedback.status} = 'open')`,
        in_progress: sql<number>`count(*) filter (where ${feedback.status} = 'in_progress')`,
        resolved: sql<number>`count(*) filter (where ${feedback.status} = 'resolved')`,
        closed: sql<number>`count(*) filter (where ${feedback.status} = 'closed')`,
      })
      .from(feedback);

    return ok(c, { feedback: items, summary });
  })

  /**
   * PATCH /admin/feedback
   * Update feedback status and notes
   */
  .patch("/feedback", async (c) => {
    const result = await requireAdmin(c);
    if (!result.authorized) return errors.forbidden(c);

    const body = await c.req.json<{
      id: string;
      status?: string;
      adminNotes?: string;
    }>();

    if (!body.id) return errors.badRequest(c, "Missing feedback ID");

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.status) updateData.status = body.status;
    if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;

    const [updated] = await db
      .update(feedback)
      .set(updateData)
      .where(eq(feedback.id, body.id))
      .returning();

    if (!updated) return errors.notFound(c, "Feedback not found");

    logAdminAction({
      action: "update_feedback",
      adminId: result.session.user.id,
      adminEmail: result.session.user.email,
      targetId: body.id,
      targetType: "feedback",
      ipAddress: getClientIpForAudit(c.req.raw.headers),
      details: { status: body.status, adminNotes: body.adminNotes },
    });

    return ok(c, updated);
  });

export default adminRoute;
