import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env/server";

type DbInstance = NeonDatabase<typeof schema>;

let cached: DbInstance | undefined;

function initDb(): DbInstance {
  const pool = new Pool({ connectionString: getServerEnv().DATABASE_URL });
  return drizzle(pool, { schema });
}

// Lazy-initialized Drizzle instance. The Proxy defers Pool creation until
// first property access — importing `db` is free at module-parse time, which
// matters for Turbopack dev where the server module graph is walked
// aggressively and top-level work multiplies across HMR passes.
export const db = new Proxy({} as DbInstance, {
  get(_target, prop) {
    cached ??= initDb();
    const value = Reflect.get(cached, prop, cached);
    return typeof value === "function" ? value.bind(cached) : value;
  }
});

export type Database = DbInstance;
