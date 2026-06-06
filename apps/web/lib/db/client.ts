import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";

/**
 * Round 15.5 Task 1 — lazy DB client.
 *
 * Previously this module called `getServerEnv()` at module import,
 * which forced env validation during `next build`'s page-data
 * collection step. Routes like `/api/cron/lifecycle` and
 * `/api/webhooks/stripe` import-graph their way to this file, so
 * running `pnpm build` without `DATABASE_URL` (or any other required
 * env var) crashed the build.
 *
 * The fix: defer pool creation until first DB use. The exported
 * `db` is a Proxy that lazily constructs the underlying drizzle
 * instance on first method access. Call sites are unchanged — they
 * still write `db.select().from(...)` — and the env validation still
 * runs (fail-fast) the first time something actually touches the DB.
 *
 * Same fail-fast contract: invoke the DB without DATABASE_URL set
 * and you get the env validator error. Lazy ≠ silent.
 */

type Database = NeonDatabase<typeof schema>;

let _db: Database | null = null;

function getDb(): Database {
  if (_db) return _db;
  const { DATABASE_URL } = getServerEnv();
  const pool = new Pool({ connectionString: DATABASE_URL });
  // Neon's serverless Pool is WebSocket-backed. In serverless the socket is
  // dropped when the function is suspended or hits Neon's idle timeout, which
  // node-postgres surfaces as an 'error' event on the idle client. Without a
  // listener that event is rethrown as an uncaught exception (it was reaching
  // Sentry as "Connection terminated unexpectedly"). Log and swallow — the next
  // query reconnects; an idle-socket drop is expected, not a request failure.
  pool.on("error", (error: unknown) => {
    logger.warn("db_pool_idle_error", {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  _db = drizzle(pool, { schema });
  return _db;
}

// Proxy preserves the `import { db } from "@/lib/db/client"` shape
// without forcing every call site to switch to a `getDb()` accessor.
// The underlying drizzle object dispatches through string keys
// (select, insert, update, delete, transaction, $count, etc.), all
// of which route through the Proxy's `get` trap. We forward to the
// real drizzle instance on every access.
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  }
});

export type { Database };
