import type { ApiError } from "@repo/shared";
import type { Context } from "hono";

/**
 * Standard error response helper
 * Ensures consistent error format across the API
 */
export function errorResponse(
  c: Context,
  status: number,
  message: string,
  code?: string,
  issues?: any[],
) {
  const error: ApiError = {
    message,
    ...(code && { code }),
    ...(issues && { issues }),
  };
  return c.json(error, status as any);
}
