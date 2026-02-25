import { and, lt, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { db } from "../db";
import { aiTasks } from "../db/schema";

/**
 * Register scheduled cleanup job
 *
 * Removes old completed/failed tasks to prevent table bloat.
 * Runs on a cron schedule (configured in jobs/index.ts).
 */
export function registerCleanupJob(boss: PgBoss) {
  boss.work("cleanup-old-tasks", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await db
      .delete(aiTasks)
      .where(
        and(
          sql`${aiTasks.status} IN ('completed', 'failed')`,
          lt(aiTasks.createdAt, thirtyDaysAgo),
        ),
      );

    console.log("[Job:cleanup] Removed old tasks");
  });
}
