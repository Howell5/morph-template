import { zValidator } from "@hono/zod-validator";
import { REFERRAL_CONFIG, applyReferralSchema } from "@repo/shared";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { referrals, user } from "../db/schema";
import { applyReferralCode } from "../lib/referral-service";
import { errors, ok } from "../lib/response";

const referralRoute = new Hono()
  /**
   * POST /referral/apply
   * Apply a referral code after signup
   */
  .post("/apply", zValidator("json", applyReferralSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return errors.unauthorized(c);

    const { code } = c.req.valid("json");

    // The referral code is the referrer's user ID
    const result = await applyReferralCode(session.user.id, code, c.req.raw.headers);

    if (!result.success) {
      return errors.badRequest(c, result.error ?? "Failed to apply referral");
    }

    return ok(c, { applied: true });
  })

  /**
   * GET /referral/stats
   * Get user's referral stats and link
   */
  .get("/stats", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return errors.unauthorized(c);

    const userData = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: {
        totalReferrals: true,
        totalReferralCredits: true,
        referralCreditsThisMonth: true,
      },
    });

    return ok(c, {
      referralCode: session.user.id,
      totalReferrals: userData?.totalReferrals ?? 0,
      totalCreditsEarned: userData?.totalReferralCredits ?? 0,
      creditsThisMonth: userData?.referralCreditsThisMonth ?? 0,
      monthlyLimit: REFERRAL_CONFIG.MONTHLY_LIMIT,
      rewardPerReferral: REFERRAL_CONFIG.REFERRER_REWARD,
    });
  })

  /**
   * GET /referral/history
   * Get recent referral history
   */
  .get("/history", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return errors.unauthorized(c);

    const history = await db.query.referrals.findMany({
      where: eq(referrals.referrerId, session.user.id),
      orderBy: [desc(referrals.createdAt)],
      limit: 20,
      columns: {
        id: true,
        referrerCredits: true,
        status: true,
        createdAt: true,
      },
    });

    return ok(c, { referrals: history });
  });

export default referralRoute;
