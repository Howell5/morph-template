import type { ApiError } from "@repo/shared";
import type { AppType } from "@repo/api";
import { hc } from "hono/client";
import { env } from "../env";

/**
 * Custom fetch wrapper that throws on non-2xx responses
 * By default, fetch doesn't throw on HTTP errors (4xx, 5xx)
 */
async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include", // Important: allows cookies for Better Auth
  });

  if (!response.ok) {
    // Try to parse error as ApiError
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = (await response.json()) as ApiError;
      errorMessage = errorData.message || errorMessage;
    } catch {
      // If parsing fails, use default message
    }

    const error = new Error(errorMessage);
    throw error;
  }

  return response;
}

/**
 * Typed Hono client with custom fetch wrapper
 * Inherits full type safety from backend AppType
 */
export const api = hc<AppType>(env.VITE_API_URL, {
  fetch: apiFetch,
});
