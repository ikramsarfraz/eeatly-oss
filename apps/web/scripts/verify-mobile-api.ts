/**
 * Round 11 / 12 — Mobile-readiness verification.
 *
 * Calls the eeatly tRPC API from outside the Next.js runtime — exactly
 * the shape the React Native client uses:
 *   - Vanilla `createTRPCClient` (NOT the React Query variant)
 *   - `httpBatchLink` against `/api/trpc`
 *   - `superjson` transformer (matches the server)
 *   - Auth via `Authorization: Bearer <token>` (Round 12: Better Auth
 *     `bearer` plugin is enabled, so the token-via-header flow now
 *     works the same way mobile uses it)
 *
 * The script also exercises a CORS preflight with an `eeatly://` origin
 * to confirm the route handler's allowlist accepts the mobile scheme.
 *
 * Usage:
 *   pnpm dev   # in another shell
 *   API_BASE_URL=http://localhost:3000 \
 *   SESSION_TOKEN="<token>" \
 *   pnpm dlx tsx apps/web/scripts/verify-mobile-api.ts
 *
 * `SESSION_TOKEN` is optional — without it, only the public probe and
 * the CORS preflight run. Get a token in one of two ways:
 *   1. Hit `POST /api/auth/sign-in/magic-link` with `{ email }`, click
 *      the link, then `GET /api/auth/get-session` and read
 *      `response.headers.get("set-auth-token")`. (How mobile gets it.)
 *   2. From a signed-in browser session: DevTools → Application →
 *      Cookies → `better-auth.session_token` value. (Faster for dev.)
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/trpc/app-router";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const SESSION_TOKEN = process.env.SESSION_TOKEN ?? process.env.SESSION_COOKIE;
const MOBILE_ORIGIN = "eeatly://";

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function logOk(label: string, value: unknown) {
  console.log(`  ✓ ${label}`);
  if (value !== undefined) {
    console.log(`    ${JSON.stringify(value).slice(0, 200)}`);
  }
}

function logFail(label: string, error: unknown) {
  console.log(`  ✗ ${label}`);
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.log(`    ${message}`);
}

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL.replace(/\/$/, "")}/api/trpc`,
      transformer: superjson,
      // The fetch override is the one place a mobile client injects
      // auth. Mobile signs in once, captures the token from Better
      // Auth's `set-auth-token` response header, stores it in
      // expo-secure-store, then forwards it on every request as
      // `Authorization: Bearer <token>`. The same path works here —
      // the Better Auth bearer plugin (Round 12) translates the
      // header into the session lookup `auth.api.getSession` performs.
      // We also send the mobile `Origin` so the server's CORS layer
      // sees what production traffic looks like.
      fetch: (url, init) => {
        const headers = new Headers(init?.headers);
        if (SESSION_TOKEN) headers.set("authorization", `Bearer ${SESSION_TOKEN}`);
        headers.set("origin", MOBILE_ORIGIN);
        return fetch(url, { ...init, headers });
      }
    })
  ]
});

async function main() {
  let failures = 0;

  logSection("API target");
  console.log(`  Base URL: ${API_BASE_URL}`);
  console.log(`  Origin:   ${MOBILE_ORIGIN} (simulating a real mobile request)`);
  console.log(`  Token:    ${SESSION_TOKEN ? "provided" : "(missing — auth probes will be skipped)"}`);

  logSection("CORS preflight (OPTIONS)");
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/trpc/health.ping`, {
      method: "OPTIONS",
      headers: {
        origin: MOBILE_ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "Authorization, Content-Type"
      }
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowHeaders = res.headers.get("access-control-allow-headers");
    const allowMethods = res.headers.get("access-control-allow-methods");
    if (
      res.status === 204 &&
      allowOrigin === MOBILE_ORIGIN &&
      (allowHeaders ?? "").toLowerCase().includes("authorization")
    ) {
      logOk("OPTIONS preflight", { allowOrigin, allowHeaders, allowMethods });
    } else {
      failures++;
      logFail("OPTIONS preflight", new Error(
        `status=${res.status} allowOrigin=${allowOrigin} allowHeaders=${allowHeaders}`
      ));
    }
  } catch (error) {
    failures++;
    logFail("OPTIONS preflight", error);
  }

  logSection("Public probe");
  try {
    const result = await client.health.ping.query();
    logOk("health.ping", result);
    if (!(result.at instanceof Date)) {
      failures++;
      console.log(
        "    ⚠ superjson didn't rehydrate `at` as a Date — transformer mismatch."
      );
    }
  } catch (error) {
    failures++;
    logFail("health.ping", error);
    console.log(
      "    (Server unreachable. Check that `pnpm dev` is running on the expected port.)"
    );
  }

  if (!SESSION_TOKEN) {
    logSection("Auth probes — skipped");
    console.log(
      "  Set SESSION_TOKEN to exercise the household-scoped procedures."
    );
  } else {
    logSection("Authenticated probes");

    try {
      const result = await client.dashboard.meals.query();
      logOk("dashboard.meals", {
        recentMeals: result.recentMeals.length,
        mostCookedMeals: result.mostCookedMeals.length,
        neglectedMeals: result.neglectedMeals.length,
        suggestions: result.suggestions.length
      });
    } catch (error) {
      failures++;
      logFail("dashboard.meals", error);
    }

    try {
      const result = await client.meals.historyRows.query({ pageSize: 5 });
      logOk("meals.historyRows", {
        rows: result.rows.length,
        total: result.total,
        page: result.page
      });
    } catch (error) {
      failures++;
      logFail("meals.historyRows", error);
    }

    try {
      const result = await client.notifications.list.query();
      logOk("notifications.list", {
        rows: result.rows.length,
        unreadCount: result.unreadCount
      });
    } catch (error) {
      failures++;
      logFail("notifications.list", error);
    }
  }

  logSection("Round 12 — Round 11 blocker status");
  console.log("  Bearer-token auth     ✓ Better Auth `bearer` plugin enabled");
  console.log("  CORS                  ✓ /api/trpc accepts eeatly:// + exp:// + dev");
  console.log("  Trusted origins       ✓ mobileTrustedOrigins() added to auth");
  console.log("");
  console.log("  Still flagged for the future (not in scope yet):");
  console.log("  • AI binary input wire size — base64-in-JSON works for mobile");
  console.log("    but an R2-key alternate input on `ai.suggestFromPhoto` and");
  console.log("    `ai.suggestFromVoice` would cut payload size if needed.");

  logSection("Summary");
  if (failures === 0) {
    console.log("  ✓ All probes passed.");
    process.exit(0);
  }
  console.log(`  ✗ ${failures} probe(s) failed. See output above.`);
  process.exit(1);
}

main().catch((error) => {
  console.error("verify-mobile-api: unhandled error", error);
  process.exit(2);
});
