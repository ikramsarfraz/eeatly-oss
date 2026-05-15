"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/app-router";

/**
 * The single `trpc` client surface — `trpc.X.Y.useQuery()` /
 * `useMutation()` everywhere in client components. The type-only
 * import on `AppRouter` is what makes call-sites typecheck without
 * the client bundle pulling in any server code (the type is erased
 * at build).
 */
export const trpc = createTRPCReact<AppRouter>();
