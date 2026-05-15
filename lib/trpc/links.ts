"use client";

import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";

/**
 * Round 11 — tRPC client link chain.
 *
 * `loggerLink` runs in development only — it prints procedure latency
 * and shape to the browser console, which is invaluable when wiring
 * up a new mutation but pure noise in prod.
 *
 * `httpBatchLink` is the default transport. Same `/api/trpc` endpoint
 * as the server route handler. Batching coalesces concurrent calls
 * from the same render pass into one request — meaningfully fewer
 * round-trips for pages that hydrate three or four hooks at once
 * (dashboard, recipe view).
 */
function getBaseUrl(): string {
  // Browser: relative URL is correct + cheaper (no DNS in client builds).
  if (typeof window !== "undefined") return "";
  // Server-side: must be absolute. Use the canonical app URL the rest of
  // the stack reads (matches NEXT_PUBLIC_APP_URL on prod, BETTER_AUTH_URL
  // in dev).
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function buildTrpcLinks() {
  return [
    loggerLink({
      enabled: (op) =>
        process.env.NODE_ENV === "development" ||
        (op.direction === "down" && op.result instanceof Error)
    }),
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson
    })
  ];
}
