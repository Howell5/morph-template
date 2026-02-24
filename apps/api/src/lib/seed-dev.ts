import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/schema";

const DEV_ACCOUNT = {
  email: "test@test.com",
  password: "password123",
  name: "Dev User",
};

/**
 * Seed a default test account in non-production environments
 * Idempotent: skips if the user already exists
 */
export async function seedDevAccounts(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  try {
    const existing = await db.query.user.findFirst({
      where: eq(user.email, DEV_ACCOUNT.email),
    });

    if (existing) {
      console.log(`[Seed] Dev account already exists: ${DEV_ACCOUNT.email}`);
      return;
    }

    await auth.api.signUpEmail({
      body: {
        email: DEV_ACCOUNT.email,
        password: DEV_ACCOUNT.password,
        name: DEV_ACCOUNT.name,
      },
    });

    console.log(`[Seed] Created dev account: ${DEV_ACCOUNT.email}`);
  } catch (err) {
    console.warn("[Seed] Failed to create dev account:", err);
  }
}
