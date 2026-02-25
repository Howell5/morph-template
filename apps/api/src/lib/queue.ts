import { PgBoss } from "pg-boss";

let _boss: PgBoss | null = null;

/**
 * Get pg-boss queue instance (singleton)
 * Uses the same DATABASE_URL as Drizzle -- no extra infrastructure needed
 */
export function getQueue(): PgBoss {
  if (!_boss) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    _boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: "pgboss",
    });
  }
  return _boss;
}

/**
 * Stop pg-boss gracefully
 * Called during server shutdown
 */
export async function stopQueue(): Promise<void> {
  if (_boss) {
    try {
      await _boss.stop({ graceful: true, timeout: 30000 });
      _boss = null;
      console.log("[Queue] Stopped gracefully");
    } catch (error) {
      console.error("[Queue] Error stopping:", error);
    }
  }
}
