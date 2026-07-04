import "server-only";

import { withPrivileged, withRlsContext } from "@/lib/db/client";
import {
  getCurrentHousehold,
  requireCurrentUser,
  requirePlatformAdmin,
  type AppUser,
  type CurrentHousehold
} from "@/lib/auth/session";

/**
 * RLS entry points for server components + route handlers.
 *
 * Why these exist: tRPC procedures get their RLS scope from `rlsMiddleware`,
 * but server components / route handlers call services directly with the global
 * `db`. With RLS enabled, any such read OUTSIDE a `withRlsContext` runs with no
 * `app.current_user_id` and returns zero rows. AsyncLocalStorage also does NOT
 * propagate reliably across React's RSC render tree, so the scope must wrap the
 * page's own data-loading function (not a parent layout).
 *
 * User resolution (Better Auth) runs on the PRIVILEGED connection, so it stays
 * OUTSIDE the RLS scope; everything that touches `db` runs inside.
 */

/** Resolve the signed-in user (redirects if absent), then run `fn` RLS-scoped. */
export async function loadAuthed<T>(fn: (user: AppUser) => Promise<T>): Promise<T> {
  const user = await requireCurrentUser();
  return withRlsContext(user.id, () => fn(user));
}

/** As `loadAuthed`, plus the current household (resolved inside the RLS scope). */
export async function loadHousehold<T>(
  fn: (args: { user: AppUser; household: CurrentHousehold }) => Promise<T>
): Promise<T> {
  const user = await requireCurrentUser();
  return withRlsContext(user.id, async () => {
    const household = await getCurrentHousehold(user.id);
    return fn({ user, household });
  });
}

/**
 * Admin pages: gate on platform-admin, then run on the PRIVILEGED connection.
 * Admins legitimately read across every user, which RLS scoped to their own id
 * would block.
 */
export async function loadAdmin<T>(fn: (user: AppUser) => Promise<T>): Promise<T> {
  const user = await requirePlatformAdmin();
  return withPrivileged(() => fn(user));
}
