import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "@eeatly/api";
import superjson from "superjson";
import { TRPC_URL } from "./api-base";
import { getSessionToken } from "./auth/session";

/**
 * Round 12 — typed tRPC React Query hooks for the mobile app.
 *
 * Mirrors the web client (`apps/web/lib/trpc/client.ts`) but with two
 * mobile-specific bits in the link chain:
 *   - `fetch` override that reads the bearer token from SecureStore and
 *     attaches `Authorization: Bearer <token>`. Same flow the
 *     Round 12 verify-mobile-api.ts script exercises.
 *   - `transformer: superjson` (same as server, non-negotiable for
 *     AppRouter inference to round-trip Date/Set/etc).
 *
 * The same `QueryClient` is shared between `trpc.Provider` and
 * `QueryClientProvider` via `lib/providers.tsx`.
 */
export const trpc = createTRPCReact<AppRouter>();

export function buildMobileTrpcLinks() {
  return [
    httpBatchLink({
      url: TRPC_URL,
      transformer: superjson,
      async fetch(url, init) {
        const headers = new Headers(init?.headers);
        const token = await getSessionToken();
        if (token) {
          headers.set("authorization", `Bearer ${token}`);
        }
        return fetch(url, { ...init, headers });
      }
    })
  ];
}
