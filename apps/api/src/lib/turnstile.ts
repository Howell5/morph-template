/**
 * Cloudflare Turnstile verification
 *
 * Bot protection for sensitive endpoints.
 * Graceful degradation: allows through on timeout and skips in dev.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 3000;

interface TurnstileOptions {
  ip?: string;
  timeoutMs?: number;
}

interface TurnstileResult {
  success: boolean;
  error?: string;
}

/**
 * Check if Turnstile verification should be skipped
 */
export function shouldSkipTurnstile(): boolean {
  return !process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Verify a Turnstile token
 * Returns success:true if valid, skipped, or timed out (graceful degradation)
 */
export async function verifyTurnstile(
  token: string,
  options?: TurnstileOptions,
): Promise<TurnstileResult> {
  // Skip in development when no secret key configured
  if (shouldSkipTurnstile()) {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: "Missing Turnstile token" };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const body: Record<string, string> = {
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
    };

    if (options?.ip) {
      body.remoteip = options.ip;
    }

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = (await response.json()) as { success: boolean; "error-codes"?: string[] };

    if (!data.success) {
      return {
        success: false,
        error: `Turnstile verification failed: ${(data["error-codes"] ?? []).join(", ")}`,
      };
    }

    return { success: true };
  } catch (error) {
    // Graceful degradation: allow on timeout or network error
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[Turnstile] Verification timed out, allowing request");
      return { success: true };
    }

    console.error("[Turnstile] Verification error:", error);
    return { success: true }; // Allow through on error
  }
}
