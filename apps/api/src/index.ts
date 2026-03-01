// Configure HTTP proxy for Node.js fetch (useful for local development)
// Supports: HTTPS_PROXY, https_proxy, HTTP_PROXY, http_proxy, ALL_PROXY, all_proxy
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.ALL_PROXY ||
  process.env.all_proxy;

if (proxyUrl) {
  // Dynamic import to avoid issues if undici is not available
  import("undici")
    .then(({ ProxyAgent, setGlobalDispatcher }) => {
      setGlobalDispatcher(new ProxyAgent(proxyUrl));
      console.log(`[Proxy] HTTP proxy configured: ${proxyUrl}`);
    })
    .catch(() => {
      console.warn("[Proxy] Failed to configure proxy: undici not available");
    });
}

// Now import other modules
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { auth } from "./auth";
import { checkDatabaseHealth, closeDatabase } from "./db";
import { validateEnv } from "./env";
import { registerAllJobs } from "./jobs";
import { isAIConfigured } from "./lib/ai";
import { logger } from "./lib/logger";
import { getQueue, stopQueue } from "./lib/queue";
import { isR2Configured } from "./lib/r2";
import { seedDevAccounts } from "./lib/seed-dev";
import { captureException, initSentry } from "./lib/sentry";
import adminRoute from "./routes/admin";
import chatRoute from "./routes/chat";
import checkoutRoute from "./routes/checkout";
import feedbackRoute from "./routes/feedback";
import ordersRoute from "./routes/orders";
import postsRoute from "./routes/posts";
import referralRoute from "./routes/referral";
import tasksRoute from "./routes/tasks";
import uploadRoute from "./routes/upload";
import userRoute from "./routes/user";
import webhooksRoute from "./routes/webhooks";

const env = validateEnv();

// Initialize Sentry error tracking (no-op if SENTRY_DSN not set)
initSentry();

// Seed dev accounts (fire-and-forget, non-production only)
seedDevAccounts();

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

/**
 * Base Hono app with middleware
 * We use a separate base app for middleware that doesn't need type inference
 */
const baseApp = new Hono();

// Global error handler - catches unhandled errors to prevent crashes
baseApp.onError((err, c) => {
  logger.error({ err, path: c.req.path, method: c.req.method }, "Unhandled error");
  captureException(err, { path: c.req.path, method: c.req.method });
  return c.json(
    {
      success: false,
      error: {
        message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
        code: "INTERNAL_ERROR",
      },
    },
    500,
  );
});

// Request ID middleware — propagate or generate for tracing
baseApp.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") || crypto.randomUUID();
  c.header("x-request-id", requestId);
  await next();
});

baseApp.use("*", honoLogger());
baseApp.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return origin;

      const allowedOrigins = getAllowedOrigins();
      // Return the origin if it's allowed, otherwise return null
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
  }),
);

// Mount Better Auth routes (doesn't need RPC type inference)
// Using wildcard pattern per Better Auth docs: https://www.better-auth.com/docs/integrations/hono
baseApp.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

/**
 * Main Hono application with chained routes for RPC type inference
 * IMPORTANT: Use chained .route() calls to preserve type information
 */
// Track server shutdown state for health checks
let isShuttingDown = false;

const app = baseApp
  .get("/", (c) => {
    return c.json({
      message: "Morph Template API",
      version: "1.0.0",
    });
  })
  // Health check endpoint for Zeabur, Uptime Kuma, and monitoring
  .get("/health", async (c) => {
    if (isShuttingDown) {
      return c.json({ status: "shutting_down" }, 503);
    }

    const dbHealth = await checkDatabaseHealth();

    // DB is critical — if it's down, the whole service is unhealthy
    // Optional services (R2, AI) only cause degraded state
    const checks = {
      database: {
        status: dbHealth.healthy ? ("ok" as const) : ("error" as const),
        latencyMs: dbHealth.latencyMs,
        ...(dbHealth.error && { error: dbHealth.error }),
      },
      r2: { status: isR2Configured() ? ("ok" as const) : ("unconfigured" as const) },
      ai: { status: isAIConfigured() ? ("ok" as const) : ("unconfigured" as const) },
    };

    const status = !dbHealth.healthy ? "unhealthy" : "healthy";
    const httpStatus = dbHealth.healthy ? 200 : 503;

    return c.json({ status, checks }, httpStatus);
  })
  .route("/api/posts", postsRoute)
  .route("/api/checkout", checkoutRoute)
  .route("/api/orders", ordersRoute)
  .route("/api/webhooks", webhooksRoute)
  .route("/api/user", userRoute)
  .route("/api/upload", uploadRoute)
  .route("/api/chat", chatRoute)
  .route("/api/tasks", tasksRoute)
  .route("/api/admin", adminRoute)
  .route("/api/referral", referralRoute)
  .route("/api/feedback", feedbackRoute);

/**
 * Export the app type for frontend type inference
 * This is the key to end-to-end type safety
 */
export type AppType = typeof app;

// Start server
let server: ServerType | null = null;

if (process.env.NODE_ENV !== "test") {
  logger.info({ port: env.PORT }, "Server running");
  server = serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  // Start task queue
  const boss = getQueue();
  boss
    .start()
    .then(() => registerAllJobs(boss))
    .then(() => logger.info("Task queue started"))
    .catch((err: unknown) => logger.error({ err }, "Task queue failed to start"));
}

/**
 * Graceful shutdown handler
 * Ensures in-flight requests complete and resources are cleaned up
 */
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Graceful shutdown started");
  isShuttingDown = true;

  // Give load balancer time to stop sending traffic (health check returns 503)
  const drainDelay = 5000;
  await new Promise((resolve) => setTimeout(resolve, drainDelay));

  // Close HTTP server (stop accepting new connections)
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => {
        if (err) {
          logger.error({ err }, "Error closing HTTP server");
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Stop task queue (wait for in-progress jobs)
  await stopQueue();

  // Close database connections
  await closeDatabase();

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  captureException(err, { fatal: true, type: "uncaughtException" });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
  captureException(reason, { type: "unhandledRejection" });
  // Don't exit on unhandled rejection, just log it
  // This prevents the server from crashing on recoverable errors
});

export default app;
