import "server-only";

import { publicProcedure, router } from "../trpc";

/**
 * Smoke router. `ping` is intentionally trivial — it's the canary the
 * web client (and, eventually, the mobile client) hits to verify the
 * tRPC stack is healthy end-to-end after a deploy. No DB, no auth.
 */
export const healthRouter = router({
  ping: publicProcedure.query(() => ({ status: "ok" as const, at: new Date() }))
});
