/**
 * Round 11 / Task 6 — Mobile-readiness verification.
 *
 * Calls the eeatly tRPC API from outside the Next.js runtime — exactly
 * the shape the future React Native client will use:
 *   - Vanilla `createTRPCClient` (NOT the React Query variant)
 *   - `httpBatchLink` against `/api/trpc`
 *   - `superjson` transformer (matches the server)
 *   - Auth via a `Cookie` header (Better Auth's default flow)
 *
 * This script is intentionally minimal. It probes a public procedure
 * to confirm the wire format works, and — when a session cookie is
 * provided — an authenticated procedure to confirm cookie-based auth
 * is reachable off-host. It does NOT attempt to fix the mobile
 * blockers (bearer tokens, CORS) — those are out of scope for
 * Round 11 per the handoff.
 *
 * Usage:
 *   pnpm dev   # in another shell
 *   API_BASE_URL=http://localhost:3000 \
 *   SESSION_COOKIE="better-auth.session_token=...; better-auth.session_data=..." \
 *   pnpm dlx tsx scripts/verify-mobile-api.ts
 *
 * `SESSION_COOKIE` is optional — without it, only the public probe
 * runs. Grab the value from a signed-in browser session: DevTools →
 * Application → Cookies → http://localhost:3000 → copy the
 * `better-auth.session_token` (+ `session_data` if present) name=value
 * pairs separated by `; `.
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/trpc/app-router";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = process.env.SESSION_COOKIE;

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
      // The fetch override is the one place a mobile client would
      // inject auth. For web, the browser attaches the Better Auth
      // cookie automatically; here we forward `SESSION_COOKIE` as
      // the `Cookie` header so the server sees an authenticated
      // session. A bearer-token mobile client would set an
      // `Authorization: Bearer <token>` header here instead.
      fetch: (url, init) => {
        const headers = new Headers(init?.headers);
        if (SESSION_COOKIE) headers.set("cookie", SESSION_COOKIE);
        return fetch(url, { ...init, headers });
      }
    })
  ]
});

async function main() {
  let failures = 0;

  logSection("API target");
  console.log(`  Base URL: ${API_BASE_URL}`);
  console.log(`  Cookie:   ${SESSION_COOKIE ? "provided" : "(missing — auth probes will be skipped)"}`);

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

  if (!SESSION_COOKIE) {
    logSection("Auth probes — skipped");
    console.log(
      "  Set SESSION_COOKIE to exercise the household-scoped procedures."
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

  logSection("Known mobile-consumption blockers");
  console.log("  These are documented but NOT fixed in Round 11:");
  console.log("");
  console.log("  1. Bearer-token auth.");
  console.log("     Better Auth's default cookie flow doesn't translate cleanly");
  console.log("     to a native mobile app. Cookies work for this script (we");
  console.log("     forward the `Cookie` header explicitly) but a production");
  console.log("     mobile client should use bearer tokens via the Better Auth");
  console.log("     `bearer` plugin. The seam to wire this in lives in");
  console.log("     `server/trpc/context.ts` — read `Authorization: Bearer …`");
  console.log("     before falling through to the cookie lookup.");
  console.log("");
  console.log("  2. CORS.");
  console.log("     The `/api/trpc/[trpc]` route doesn't set CORS headers.");
  console.log("     Same-origin web works because cookies + fetch agree on the");
  console.log("     host; cross-origin mobile (or any third party) will need");
  console.log("     `Access-Control-Allow-{Origin,Credentials,Methods,Headers}`");
  console.log("     set explicitly in the fetch adapter's response hook.");
  console.log("");
  console.log("  3. Trusted origins.");
  console.log("     Better Auth's `trustedOrigins` list in `lib/auth/index.ts`");
  console.log("     is currently dev hosts + the web app URL. Add the mobile");
  console.log("     app's custom URL scheme when shipping.");
  console.log("");
  console.log("  4. Wire size for AI binary inputs.");
  console.log("     `ai.suggestFromPhoto` / `ai.suggestFromVoice` accept");
  console.log("     base64-in-JSON. Mobile clients can do the same, but if the");
  console.log("     base64 overhead bothers anyone, add an R2-key alternate");
  console.log("     input to those procedures.");

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
