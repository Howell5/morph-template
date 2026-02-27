import { zValidator } from "@hono/zod-validator";
import { creditRecordsQuerySchema, updateUserSchema } from "@repo/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { creditRecords, user } from "../db/schema";
import { getUserCreditsBalance, grantDailyLoginReward } from "../lib/credits-service";
import { errors, ok } from "../lib/response";

const userRoute = new Hono()
  /**
   * GET /user/me
   * Get current user's profile with credits breakdown
   * Auto-grants daily login reward
   */
  .get("/me", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    // Grant daily login reward (idempotent - only once per day)
    const balance = await grantDailyLoginReward(session.user.id);

    const userData = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        subscriptionTier: true,
      },
    });

    if (!userData) {
      return errors.notFound(c, "User not found");
    }

    return ok(c, {
      ...userData,
      credits: balance
        ? {
            daily: balance.dailyCredits,
            subscription: balance.subscriptionCredits,
            subscriptionLimit: balance.subscriptionCreditsLimit,
            bonus: balance.bonusCredits,
            total: balance.totalAvailable,
            dailyResetsAt: balance.dailyResetsAt.toISOString(),
            subscriptionResetsAt: balance.subscriptionResetsAt?.toISOString() ?? null,
          }
        : null,
    });
  })

  /**
   * GET /user/subscription
   * Get subscription status and entitlements
   */
  .get("/subscription", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const userData = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!userData) {
      return errors.notFound(c, "User not found");
    }

    const balance = await getUserCreditsBalance(session.user.id);

    return ok(c, {
      tier: userData.subscriptionTier,
      expiresAt: userData.subscriptionExpiresAt?.toISOString() ?? null,
      dailyCredits: balance?.dailyCredits ?? 0,
      subscriptionCredits: balance?.subscriptionCredits ?? 0,
      subscriptionCreditsLimit: balance?.subscriptionCreditsLimit ?? 0,
      bonusCredits: balance?.bonusCredits ?? 0,
      totalCredits: balance?.totalAvailable ?? 0,
      dailyResetsAt: balance?.dailyResetsAt.toISOString() ?? null,
      subscriptionResetsAt: balance?.subscriptionResetsAt?.toISOString() ?? null,
    });
  })

  /**
   * GET /user/usage-history
   * Get credit usage records (paginated)
   */
  .get("/usage-history", zValidator("query", creditRecordsQuerySchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { page, limit, type } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [eq(creditRecords.userId, session.user.id)];
    if (type) {
      conditions.push(eq(creditRecords.type, type));
    }

    const [records, countResult] = await Promise.all([
      db.query.creditRecords.findMany({
        where: and(...conditions),
        orderBy: [desc(creditRecords.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(creditRecords)
        .where(and(...conditions)),
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
   * PATCH /user/me
   * Update current user's profile
   */
  .patch("/me", zValidator("json", updateUserSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { name } = c.req.valid("json");

    const [updatedUser] = await db
      .update(user)
      .set({ name, updatedAt: new Date() })
      .where(eq(user.id, session.user.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
      });

    if (!updatedUser) {
      return errors.notFound(c, "User not found");
    }

    return ok(c, updatedUser);
  });

export default userRoute;
