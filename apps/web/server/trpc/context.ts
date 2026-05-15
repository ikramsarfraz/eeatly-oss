import "server-only";

import { cache } from "react";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import type { AppUser, CurrentHousehold } from "@/lib/auth/session";
import type { UserRole } from "@/types";

/**
 * Per-request tRPC context. Lift the Better Auth session ONCE and stash
 * it here — every procedure that calls `protectedProcedure` will read
 * `ctx.user` instead of re-resolving the cookie + DB lookup. Same
 * memoization story as `lib/auth/session.ts`, but bound to the tRPC
 * call rather than React's render tree (so it survives fetch-adapter
 * lifecycles outside the App-Router render).
 *
 * Round 12 — bearer-token support is live. The Better Auth `bearer`
 * plugin (registered in `lib/auth/index.ts`) intercepts the request
 * BEFORE `auth.api.getSession` runs and converts an
 * `Authorization: Bearer <token>` header into the equivalent session
 * cookie lookup, transparently. No code change here was required;
 * web cookies and mobile bearer tokens both resolve through the same
 * `getSession({ headers })` call below.
 */
export type TRPCContext = {
  user: AppUser | null;
  headers: Headers;
  /**
   * Memoized current-household resolver. Same React.cache() trick as
   * `lib/auth/session.ts` — multiple procedures in one request that
   * need the household share a single DB round-trip. Procedures that
   * already have a `householdId` in their input should NOT use this;
   * `householdMemberProcedure` handles that case.
   */
  getCurrentHousehold: () => Promise<CurrentHousehold>;
};

export async function createTRPCContext(opts: {
  req: Request;
}): Promise<TRPCContext> {
  const headers = opts.req.headers;

  // One session lookup per request, memoized via React.cache(). The
  // same `getCurrentUser()` pattern in `lib/auth/session.ts` already
  // does this for server components; we do it again here because the
  // fetch adapter doesn't share React's request scope.
  let user: AppUser | null = null;
  try {
    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: (session.user.role as UserRole | undefined) ?? "root_app_user"
      };
    }
  } catch (error) {
    logger.warn("trpc_session_lookup_failed", {
      requestId: (await getRequestId()) ?? undefined,
      error: error instanceof Error ? error.message : String(error)
    });
    // Fall through with user=null; protected procedures will reject.
  }

  // Lazy household lookup. Wrapped in React.cache so multiple calls
  // within the same request share. We need the closure to capture the
  // resolved userId; cache() keys on argument identity, so this works
  // when called repeatedly without args.
  const cachedHouseholdLookup = cache(async (): Promise<CurrentHousehold> => {
    if (!user) {
      throw new Error("getCurrentHousehold called without an authenticated user.");
    }
    const { getCurrentHousehold } = await import("@/lib/auth/session");
    return getCurrentHousehold(user.id);
  });

  return {
    user,
    headers,
    getCurrentHousehold: cachedHouseholdLookup
  };
}
