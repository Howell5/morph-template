/**
 * Audit Log Service
 *
 * Structured logging for admin actions.
 * Outputs JSON format for log aggregation tools (Datadog, CloudWatch, etc.)
 */

export type AuditAction =
  | "grant_credits"
  | "update_feedback"
  | "view_ai_logs"
  | "view_user_data"
  | "search_users";

interface AuditLogEntry {
  action: AuditAction;
  adminId: string;
  adminEmail: string;
  targetId?: string;
  targetType?: "user" | "feedback" | "credit_record";
  ipAddress?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an admin action
 */
export function logAdminAction(entry: AuditLogEntry): void {
  console.log(
    JSON.stringify({
      type: "admin_audit",
      timestamp: new Date().toISOString(),
      ...entry,
    }),
  );
}

/**
 * Extract client IP from headers for audit purposes
 */
export function getClientIpForAudit(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
