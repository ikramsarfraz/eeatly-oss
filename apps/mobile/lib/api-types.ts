/**
 * Round 12 — type-only proof that `@eeatly/api` resolves from the
 * mobile app. The `AppRouter` type comes from the web app's tRPC
 * router (`apps/web/server/trpc/app-router.ts`) via packages/api's
 * re-export. TypeScript strips this import at compile time, so no
 * server code lands in the mobile bundle.
 *
 * Task 5 will use this exact type to build a typed mobile tRPC client.
 */
import type { AppRouter } from "@eeatly/api";

// Pin the union type so any future drift here is caught by `tsc`.
export type EeatlyAppRouter = AppRouter;
