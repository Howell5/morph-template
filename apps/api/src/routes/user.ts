import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/schema";
import { errorResponse } from "../lib/response";

const userRoute = new Hono()
	/**
	 * GET /user/me
	 * Get current user's profile including credits
	 */
	.get("/me", async (c) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			return errorResponse(c, 401, "Unauthorized");
		}

		const userData = await db.query.user.findFirst({
			where: eq(user.id, session.user.id),
			columns: {
				id: true,
				name: true,
				email: true,
				credits: true,
			},
		});

		if (!userData) {
			return errorResponse(c, 404, "User not found");
		}

		return c.json(userData);
	});

export default userRoute;
