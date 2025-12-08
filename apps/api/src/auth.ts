import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

/**
 * Better Auth instance
 * Handles authentication and session management
 * Note: Environment variables are validated in index.ts via validateEnv()
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
});

/**
 * Session type inferred from Better Auth
 */
export type Session = typeof auth.$Infer.Session;
