import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { users } from "@/db/schema";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import {
  trackEvent,
  type AnalyticsEventName,
  type AnalyticsMetadata
} from "@/lib/observability/analytics";
import { protectedProcedure, publicProcedure, router } from "../trpc";

/**
 * Round 11 — fire-and-forget analytics. The legacy actions had two
 * surfaces:
 *
 *   - `trackAuthFunnel` — public (fires from the sign-in/sign-up form
 *     BEFORE the magic link redirect, so the user isn't authenticated
 *     yet). Two events: `signed_in`, `signed_up`.
 *   - `trackUserEvent` — protected; fires from in-app interactions
 *     (rediscovery click). The `completed_onboarding` branch also
 *     stamps `users.onboardingCompletedAt` for retention-query
 *     authority.
 */
const userEventNameSchema = z.enum([
  "completed_onboarding",
  "onboarding_completed",
  "rediscovery_clicked",
  "signed_in"
] as const satisfies Readonly<AnalyticsEventName[]>);

// Mirrors `AnalyticsMetadata` on the server (Record<string, primitive|null>) so
// the procedure's typed payload narrows correctly downstream.
const metadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional();

export const analyticsRouter = router({
  trackAuthFunnel: publicProcedure
    .input(z.object({ name: z.enum(["signed_in", "signed_up"]) }))
    .mutation(({ input }) => {
      const meta: AnalyticsMetadata = { stage: "magic_link_requested" };
      if (input.name === "signed_up") {
        trackActivationFunnelEvent("signed_up", { metadata: meta });
      } else {
        trackEvent({ name: "signed_in", metadata: meta });
      }
      return { ok: true as const };
    }),

  trackUserEvent: protectedProcedure
    .input(
      z.object({
        name: userEventNameSchema,
        metadata: metadataSchema
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.name === "completed_onboarding") {
        try {
          await db
            .update(users)
            .set({
              onboardingCompletedAt: new Date(),
              updatedAt: new Date()
            })
            .where(
              and(eq(users.id, ctx.user.id), isNull(users.onboardingCompletedAt))
            );
        } catch (error) {
          logger.warn("onboarding_completion_write_failed", {
            userId: ctx.user.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        trackActivationFunnelEvent("completed_onboarding", {
          userId: ctx.user.id,
          metadata: input.metadata
        });
        return { ok: true as const };
      }
      if (input.name === "rediscovery_clicked") {
        trackActivationFunnelEvent("rediscovery_clicked", {
          userId: ctx.user.id,
          metadata: input.metadata
        });
        return { ok: true as const };
      }
      trackEvent({
        name: input.name,
        userId: ctx.user.id,
        metadata: input.metadata
      });
      return { ok: true as const };
    })
});
