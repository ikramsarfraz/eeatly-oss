import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped DB identity for Row-Level Security.
 *
 * The `db` client (lib/db/client.ts) reads this store on every query to decide
 * which connection to use:
 *   - `rls`        — run inside the request transaction (`tx`) that already set
 *                    `app.current_user_id`; Postgres RLS policies key off it.
 *   - `privileged` — run on the owner connection that bypasses RLS (cron,
 *                    webhooks, admin, Better Auth, the documented effort-only
 *                    reads). Set via `withPrivileged`.
 *   - (no store)   — default to the restricted connection. With RLS enabled
 *                    this returns nothing without a GUC, so authenticated reads
 *                    MUST run inside `withRlsContext`.
 *
 * `tx` is typed `unknown` here to avoid a cycle with client.ts; the Proxy casts
 * it back to the Drizzle database type. The structural shape is a Drizzle
 * transaction handle (same query-builder surface as `db`).
 */
export type DbScope =
  | { mode: "rls"; tx: unknown; userId: string }
  | { mode: "privileged" };

export const dbScopeStorage = new AsyncLocalStorage<DbScope>();

export function getDbScope(): DbScope | undefined {
  return dbScopeStorage.getStore();
}
