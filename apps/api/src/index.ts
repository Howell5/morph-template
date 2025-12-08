import path from "node:path";
import { fileURLToPath } from "node:url";
// IMPORTANT: Load environment variables FIRST, before any other imports
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Now import other modules
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { validateEnv } from "./env";
import postsRoute from "./routes/posts";

const env = validateEnv();

/**
 * Main Hono application
 */
const app = new Hono();

// Middleware
app.use("*", logger());

// CORS configuration - supports both development and production
const getAllowedOrigins = () => {
  if (env.NODE_ENV === "production") {
    // Production: only allow configured frontend URL
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.warn("⚠️  FRONTEND_URL not set in production, CORS may block requests");
      return [];
    }
    return [frontendUrl];
  }
  // Development: allow local Vite dev server
  return ["http://localhost:5173", "http://localhost:5174"];
};

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return true;

      const allowedOrigins = getAllowedOrigins();
      return allowedOrigins.includes(origin);
    },
    credentials: true,
  }),
);

// Health check
app.get("/", (c) => {
  return c.json({
    message: "Morph Template API",
    version: "1.0.0",
    status: "healthy",
  });
});

// Mount Better Auth routes
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// Mount API routes
app.route("/api/posts", postsRoute);

/**
 * Export the app type for frontend type inference
 * This is the key to end-to-end type safety
 */
export type AppType = typeof app;

// Start server
if (process.env.NODE_ENV !== "test") {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  serve({
    fetch: app.fetch,
    port: env.PORT,
  });
}

export default app;
