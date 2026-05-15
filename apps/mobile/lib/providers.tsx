import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildMobileTrpcLinks, trpc } from "./trpc";

/**
 * Round 12 — top-level providers mounted in `app/_layout.tsx`. The same
 * `QueryClient` is handed to both the tRPC and React Query providers
 * so the tRPC hooks' cache is the same surface `useQuery` /
 * `useMutation` consume.
 *
 * `useState` initializers (not module-level) so each app launch gets
 * its own clients — relevant for fast-refresh during dev.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
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
    trpc.createClient({ links: buildMobileTrpcLinks() })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
