import type { PgBoss } from "pg-boss";
import { registerAiGenerationJob } from "./ai-generation";
import { registerCleanupJob } from "./cleanup";

/**
 * Register all job handlers and scheduled tasks
 *
 * To add a new job:
 * 1. Create a file in jobs/ with registerXxxJob(boss) function
 * 2. Import and call it here
 * 3. Enqueue from any route: getQueue().send("job-name", payload)
 */
export async function registerAllJobs(boss: PgBoss) {
  // Job handlers
  registerAiGenerationJob(boss);
  registerCleanupJob(boss);

  // Cron schedules
  await boss.schedule("cleanup-old-tasks", "0 3 * * *", {}); // Daily at 3 AM UTC

  console.log("[Queue] All jobs registered");
}
