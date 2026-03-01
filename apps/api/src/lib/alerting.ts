/**
 * Lightweight business alerting via webhook (Slack/Lark/Telegram incoming webhooks)
 * Covers scenarios SaaS monitoring can't detect: AI quota, consecutive failures, etc.
 */

// In-memory dedup: same title won't re-fire within DEDUP_WINDOW_MS
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const recentAlerts = new Map<string, number>();

type Severity = "critical" | "warning";

/**
 * Send a business alert to the configured webhook
 * - Deduplicates by title (5-minute window)
 * - Silently skips if ALERT_WEBHOOK_URL is not configured
 * - Fire-and-forget (never throws)
 */
export async function sendAlert(
  severity: Severity,
  title: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Dedup check
  const now = Date.now();
  const lastSent = recentAlerts.get(title);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return;
  recentAlerts.set(title, now);

  // Clean old entries periodically
  if (recentAlerts.size > 100) {
    for (const [key, ts] of recentAlerts) {
      if (now - ts > DEDUP_WINDOW_MS) recentAlerts.delete(key);
    }
  }

  const emoji = severity === "critical" ? "🚨" : "⚠️";
  const text = [
    `${emoji} **[${severity.toUpperCase()}]** ${title}`,
    details ? `\`\`\`\n${JSON.stringify(details, null, 2)}\n\`\`\`` : "",
    `_${new Date().toISOString()}_`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
    });
  } catch {
    // Fire-and-forget — alerting should never crash the app
    console.error("[Alert] Failed to send webhook alert:", title);
  }
}
