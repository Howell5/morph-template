import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database connection (lazy initialization)
 * Using postgres.js driver with Drizzle ORM
 * Note: DATABASE_URL is validated in index.ts via validateEnv()
 */
let _db: PostgresJsDatabase<typeof schema> | null = null;

export const getDb = () => {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const client = postgres(process.env.DATABASE_URL);
    _db = drizzle(client, { schema });
  }
  return _db;
};

// For convenience, export as db (but this will initialize immediately if accessed)
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return getDb()[prop as keyof PostgresJsDatabase<typeof schema>];
  },
});
