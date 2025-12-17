import { zValidator } from "@hono/zod-validator";
import { createCheckoutSchema, getCreditPackage } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "../auth";
import { getStripe } from "../lib/stripe";
import { errorResponse } from "../lib/response";

const checkoutRoute = new Hono()
	/**
	 * POST /checkout
	 * Create a Stripe Checkout session for purchasing credits
	 */
	.post("/", zValidator("json", createCheckoutSchema), async (c) => {
		// Check Stripe configuration
		if (!process.env.STRIPE_SECRET_KEY) {
			return errorResponse(
				c,
				503,
				"Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.",
			);
		}

		// Authentication check
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			return errorResponse(c, 401, "Unauthorized");
		}

		const { packageId } = c.req.valid("json");

		// Validate package exists
		const creditPackage = getCreditPackage(packageId);
		if (!creditPackage) {
			return errorResponse(c, 400, "Invalid package ID");
		}

		try {
			const stripe = getStripe();
			const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

			// Create Stripe Checkout Session
			const checkoutSession = await stripe.checkout.sessions.create({
				payment_method_types: ["card"],
				line_items: [
					{
						price_data: {
							currency: creditPackage.currency,
							product_data: {
								name: creditPackage.name,
								description: `${creditPackage.credits} credits`,
							},
							unit_amount: creditPackage.price,
						},
						quantity: 1,
					},
				],
				mode: "payment",
				success_url: `${BETTER_AUTH_URL.replace(/\/$/, "")}/orders?success=true`,
				cancel_url: `${BETTER_AUTH_URL.replace(/\/$/, "")}/pricing?canceled=true`,
				client_reference_id: session.user.id,
				metadata: {
					userId: session.user.id,
					packageId: creditPackage.id,
					credits: creditPackage.credits.toString(),
				},
			});

			if (!checkoutSession.url) {
				return errorResponse(c, 500, "Failed to create checkout session");
			}

			return c.json({
				checkoutUrl: checkoutSession.url,
				sessionId: checkoutSession.id,
			});
		} catch (error) {
			console.error("Stripe checkout error:", error);
			return errorResponse(c, 500, "Failed to create checkout session");
		}
	});

export default checkoutRoute;
