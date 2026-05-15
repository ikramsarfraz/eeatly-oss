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
 *
 * Round 12 — CORS handling added so the mobile app (custom URL scheme
 * + Expo dev variants) can hit this endpoint. Web continues to use
 * same-origin requests, so the new headers are invisible to the
 * existing flow; we only echo `Access-Control-Allow-Origin` when the
 * request's `Origin` matches an allowlist, falling silently otherwise.
 */
export const dynamic = "force-dynamic";

/**
 * Origin allowlist for mobile + dev tooling. Web requests are
 * same-origin, so they don't hit this allowlist — they don't send a
 * cross-origin `Origin` header that CORS would gate on. Patterns:
 *
 *   - `eeatly://` — production mobile app deep-link scheme
 *   - `exp://...` — Expo Go dev runtime
 *   - `http://localhost:8081` — Expo Metro bundler
 *   - `http://localhost:19006` — Expo Web dev port
 *   - localhost dev ports for Next + Vite are kept open in dev only,
 *     mirroring the Better Auth `developmentLocalhostOrigins` list.
 *
 * Keep in sync with `lib/auth/index.ts:mobileTrustedOrigins`.
 */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === "eeatly://") return true;
  if (origin.startsWith("exp://")) return true;
  if (process.env.NODE_ENV !== "production") {
    if (origin.startsWith("http://localhost:")) return true;
    if (origin.startsWith("http://127.0.0.1:")) return true;
  }
  return false;
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id",
    "Access-Control-Expose-Headers": "Set-Auth-Token, X-Request-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

async function handler(req: Request) {
  const corsHeaders = buildCorsHeaders(req);

  // CORS preflight — bail before the tRPC dispatcher runs.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const response = await fetchRequestHandler({
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
        // Walk the cause chain. Drizzle's DrizzleQueryError wraps the
        // underlying pg/Neon error on `.cause`, whose message + code
        // (e.g. "42703 column does not exist", "57P01 terminating
        // connection") are what we actually need to diagnose 500s.
        const chain: Array<{ message: string; code?: string }> = [];
        let current: unknown = error;
        while (current instanceof Error && chain.length < 5) {
          const pgCode = (current as { code?: unknown }).code;
          chain.push({
            message: current.message,
            code: typeof pgCode === "string" ? pgCode : undefined
          });
          current = (current as { cause?: unknown }).cause;
        }
        logger.error("trpc_internal_error", {
          path,
          type,
          message: error.message,
          causeChain: JSON.stringify(chain),
          stack: error.stack
        });
      }
    }
  });

  // Mutate the response headers in place so CORS headers ride alongside
  // tRPC's content-type and body. Same-origin web requests get an empty
  // `corsHeaders` object so nothing changes for them.
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export { handler as GET, handler as POST, handler as OPTIONS };
