import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/app-router";
import { createTRPCContext } from "@/server/trpc/context";
import { logger } from "@/lib/observability/logger";

/**
 * Round 11 — tRPC fetch adapter. App Router gives us a Web `Request`
 * directly; the fetch adapter is the right shape (no Next-specific
 * shim). Both GET (queries) and POST (mutations) come through here.
 *
 * `dynamic = "force-dynamic"` because procedures depend on cookies
 * (Better Auth session) and rate-limit state — caching would silently
 * break auth.
 */
export const dynamic = "force-dynamic";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError({ error, path, type }) {
      // Internal errors only — TRPCError instances thrown deliberately
      // by middleware/procedures are part of the contract and don't
      // need surfacing at error level. The 5xx bucket is the signal we
      // care about for alerting.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        logger.error("trpc_internal_error", {
          path,
          type,
          message: error.message,
          stack: error.stack
        });
      }
    }
  });
}

export { handler as GET, handler as POST };
