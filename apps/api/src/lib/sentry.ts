import * as Sentry from "@sentry/node";

let _initialized = false;

/**
 * Initialize Sentry error tracking
 * Silently skips if SENTRY_DSN is not configured (dev-friendly)
 */
export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

/**
 * Check if Sentry is configured and initialized
 */
export function isSentryConfigured(): boolean {
  return !!process.env.SENTRY_DSN;
}

/**
 * Report an exception to Sentry
 * No-op if Sentry is not configured
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isSentryConfigured()) return;
  Sentry.captureException(error, { extra: context });
}

export { Sentry };
