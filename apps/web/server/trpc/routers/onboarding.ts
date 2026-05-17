import "server-only";

import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { users } from "@/db/schema";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { getRequestId } from "@/lib/observability/request-id";
import { onboardingHabitsInputSchema } from "@eeatly/api/validators/onboarding";
import { protectedProcedure, router } from "../trpc";

/**
 * Round 11 — onboarding procedures. The two phases:
 *   1. `saveHabits` — persists cook frequency + weeknight effort. Idempotent
 *      (HMR rerun, back/next nav), always writes the latest values.
 *   2. `complete` — marks onboarding done. Guarded by `WHERE
 *      onboarding_completed_at IS NULL` so re-firing doesn't stomp the
 *      original timestamp. Returns the redirect URL instead of doing
 *      the redirect itself (procedures don't redirect — clients do).
 *
 * Round 24 — `status` exposes the onboarding-completion bit for the
 * mobile navigation gate. Web reads it server-side via `db` in the
 * route layer, but mobile needs a client-callable surface (Better
 * Auth's session doesn't carry custom user columns).
 *
 * `updatePreferences` mirrors `saveHabits` but is called from
 * `/settings` after onboarding completes. Same schema, different
 * revalidation path.
 */
export const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    return { completed: !!row?.onboardingCompletedAt };
  }),

  saveHabits: protectedProcedure
    .input(onboardingHabitsInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await db
          .update(users)
          .set({
            cooksPerWeek: input.cooksPerWeek,
            weeknightEffort: input.weeknightEffort,
            updatedAt: new Date()
          })
          .where(eq(users.id, ctx.user.id));
      } catch (error) {
        logger.warn("onboarding_habits_save_failed", {
          requestId: (await getRequestId()) ?? undefined,
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't save your cooking habits. Please try again."
        });
      }
      return { ok: true as const };
    }),

  complete: protectedProcedure.mutation(async ({ ctx }) => {
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
        requestId: (await getRequestId()) ?? undefined,
        userId: ctx.user.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // Non-fatal — still let the user out of /onboarding.
    }

    trackActivationFunnelEvent("completed_onboarding", {
      userId: ctx.user.id,
      metadata: { source: "multi_step_flow" }
    });

    revalidatePath("/dashboard");
    // Client navigates to this URL — procedures don't redirect.
    return { redirectTo: "/dashboard" };
  }),

  updatePreferences: protectedProcedure
    .input(onboardingHabitsInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await db
          .update(users)
          .set({
            cooksPerWeek: input.cooksPerWeek,
            weeknightEffort: input.weeknightEffort,
            updatedAt: new Date()
          })
          .where(eq(users.id, ctx.user.id));
      } catch (error) {
        logger.warn("preferences_update_failed", {
          requestId: (await getRequestId()) ?? undefined,
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't save your preferences. Please try again."
        });
      }
      revalidatePath("/settings");
      return {
        cooksPerWeek: input.cooksPerWeek,
        weeknightEffort: input.weeknightEffort
      };
    })
});
