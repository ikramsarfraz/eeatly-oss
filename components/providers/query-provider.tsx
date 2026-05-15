"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { buildTrpcLinks } from "@/lib/trpc/links";

/**
 * Round 11 — wraps the app in both TanStack Query and tRPC providers.
 * The two clients are co-located here so the cache instance is shared
 * (tRPC's hooks delegate to React Query under the hood — they MUST
 * share the same QueryClient).
 *
 * `useState` initializers (not module-level) so each request gets its
 * own client. Sharing across requests in an SSR/RSC world means
 * cross-request cache poisoning.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  const [trpcClient] = React.useState(() =>
    trpc.createClient({ links: buildTrpcLinks() })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
