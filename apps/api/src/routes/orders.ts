import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { orders } from "../db/schema";
import { errorResponse } from "../lib/response";

const ordersRoute = new Hono()
	/**
	 * GET /orders
	 * Get current user's order history
	 */
	.get("/", async (c) => {
		// Authentication check
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			return errorResponse(c, 401, "Unauthorized");
		}

		// Query user's orders
		const userOrders = await db.query.orders.findMany({
			where: eq(orders.userId, session.user.id),
			orderBy: (orders, { desc }) => [desc(orders.createdAt)],
		});

		return c.json({ orders: userOrders });
	});

export default ordersRoute;
