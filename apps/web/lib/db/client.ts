import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAppDatabaseUrl, getDatabaseUrl } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { dbScopeStorage, getDbScope, type DbScope } from "@/lib/db/request-context";

/**
 * Round 37 — Row-Level Security plumbing. Two connections back the app:
 *
 *   - `dbPrivileged` (DATABASE_URL)     — the table owner; BYPASSes RLS.
 *     Used by migrations, Better Auth, cron, webhooks, admin, and the
 *     documented effort-only reads.
 *   - `db` (DATABASE_URL_APP, restricted) — a non-owner role with RLS enforced.
 *     The default for every authenticated request. Identity is threaded per
 *     request via `withRlsContext`, which opens a transaction, sets
 *     `app.current_user_id`, and stashes the tx in `dbScopeStorage` so the
 *     `db` Proxy below routes all queries in that scope through it.
 *
 * Phased rollout: when `DATABASE_URL_APP` is unset (local dev, and prod until
 * the role is provisioned) the restricted connection FALLS BACK to the
 * privileged one and `withRlsContext` becomes a pass-through. RLS is therefore
 * completely dormant until an operator sets the var — behavior is unchanged.
 *
 * Lazy pools (Round 15.5): construction is deferred to first use so `next build`
 * doesn't need a live DATABASE_URL during page-data collection.
 */

type Database = NeonDatabase<typeof schema>;

function makePool(connectionString: string): Pool {
  const pool = new Pool({ connectionString });
  // Neon's serverless Pool is WebSocket-backed. In serverless the socket is
  // dropped when the function is suspended or hits Neon's idle timeout, which
  // node-postgres surfaces as an 'error' event on the idle client. Without a
  // listener that event is rethrown as an uncaught exception. Log and swallow —
  // the next query reconnects; an idle-socket drop is expected.
  pool.on("error", (error: unknown) => {
    logger.warn("db_pool_idle_error", {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  return pool;
}

let _privileged: Database | null = null;
let _restricted: Database | null = null;

function getPrivilegedDb(): Database {
  if (_privileged) return _privileged;
  _privileged = drizzle(makePool(getDatabaseUrl()), { schema });
  return _privileged;
}

function getRestrictedDb(): Database {
  const appUrl = getAppDatabaseUrl();
  // No restricted role provisioned yet → RLS dormant: use the privileged pool.
  if (!appUrl) return getPrivilegedDb();
  if (_restricted) return _restricted;
  _restricted = drizzle(makePool(appUrl), { schema });
  return _restricted;
}

function resolveDb(): Database {
  const scope = getDbScope();
  if (scope?.mode === "rls") return scope.tx as Database;
  if (scope?.mode === "privileged") return getPrivilegedDb();
  // No scope: default to the restricted connection. Once RLS is enabled this
  // returns nothing without a GUC, so authenticated reads MUST run inside
  // `withRlsContext`. Before DATABASE_URL_APP is set this IS the privileged
  // connection (getRestrictedDb fallback), so behavior is unchanged.
  return getRestrictedDb();
}

/**
 * Default client. Routes per the active `dbScopeStorage` scope. The Proxy
 * preserves the `import { db } from "@/lib/db/client"` shape so no call site
 * changes; the underlying drizzle object dispatches through string keys
 * (select, insert, update, delete, transaction, $count, …).
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(resolveDb(), prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(resolveDb(), prop);
  }
});

/**
 * Owner connection that bypasses RLS. Use ONLY for system paths that must see
 * across users: migrations, Better Auth, cron, webhooks, admin, and the
 * documented effort-only aggregations. Everything else uses `db`.
 */
export const dbPrivileged = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrivilegedDb(), prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getPrivilegedDb(), prop);
  }
});

/**
 * Run `fn` with the caller's identity bound to the DB session so RLS policies
 * apply. Opens one transaction per request on the restricted connection, sets
 * `app.current_user_id`, and scopes `db` to that tx for the duration.
 *
 * Pass-through when no restricted role is configured (RLS dormant).
 */
export async function withRlsContext<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!getAppDatabaseUrl()) return fn();
  const base = getRestrictedDb();
  return base.transaction(async (tx) => {
    // `true` = SET LOCAL: the GUC is scoped to this transaction and rolled back
    // on commit/abort, so a pooled connection never leaks identity across
    // requests.
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`
    );
    const scope: DbScope = { mode: "rls", tx, userId };
    return dbScopeStorage.run(scope, fn);
  });
}

/**
 * Run `fn` on the privileged connection (RLS bypassed) for system paths whose
 * code uses the global `db` import indirectly (e.g. Better Auth signup hooks
 * that call services). Prefer the explicit `dbPrivileged` client where you can.
 */
export async function withPrivileged<T>(fn: () => Promise<T>): Promise<T> {
  return dbScopeStorage.run({ mode: "privileged" }, fn);
}

export type { Database };
