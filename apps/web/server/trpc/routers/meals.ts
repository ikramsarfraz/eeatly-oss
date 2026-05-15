import "server-only";

import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { trackMealLogLifecycleEvent } from "@/lib/observability/funnel";
import { logger } from "@/lib/observability/logger";
import { effortLevelSchema, mealLogInputSchema } from "@eeatly/api/validators/meals";
import {
  createMealLog,
  deleteMealLog,
  getHistoryRows,
  getHistoryStats,
  getMealDetail
} from "@/services/meals";
import { createNotification } from "@/services/notifications";
import { householdMemberProcedure, rateLimit, router } from "../trpc";

/**
 * Round 11 — meal reads.
 *
 * `getById` is the procedure the recipe view (`/meal/[id]`, Round 10)
 * will eventually call from the client side once we move it off the
 * server-rendered page; for now it's exposed so mobile + future client
 * pages can use it without a duplicate codepath.
 *
 * `historyRows` and `historyStats` cover the /history surface. The
 * page is still server-rendered today; these procedures back the
 * future client-side filter/sort transitions.
 */
const historyOptionsSchema = z.object({
  tab: z.enum(["recent", "most", "neglected"]).optional(),
  sort: z.enum(["date", "name"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  effortLevels: z.array(effortLevelSchema).optional(),
  rangeDays: z.number().int().min(1).max(3650).nullable().optional(),
  q: z.string().max(200).optional()
});

export const mealsRouter = router({
  getById: householdMemberProcedure
    .input(z.object({ mealId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      getMealDetail(ctx.user.id, ctx.household.id, input.mealId)
    ),

  historyRows: householdMemberProcedure
    .input(historyOptionsSchema.optional())
    .query(({ ctx, input }) =>
      getHistoryRows(ctx.user.id, ctx.household.id, input)
    ),

  historyStats: householdMemberProcedure.query(({ ctx }) =>
    getHistoryStats(ctx.user.id, ctx.household.id)
  ),

  /**
   * Round 11 — log a cooking event. Idempotency via the household's
   * unique `(householdId, normalizedName)` index on `meals`: an
   * existing meal gets reused; a new one gets created. Same flow
   * the `createMealLogAction` ran behind. Source flag distinguishes
   * a fresh quick-log from a "log again" tap (funnel telemetry).
   */
  createLog: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(
      z.object({
        log: mealLogInputSchema,
        source: z.enum(["quick_log", "log_again"]).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { mealLog, mealLogCount } = await createMealLog(
        ctx.user.id,
        ctx.household.id,
        input.log
      );

      revalidatePath("/dashboard");
      revalidatePath("/history");
      revalidatePath("/ideas");
      logger.info("meal_log_created", {
        userId: ctx.user.id,
        mealLogId: mealLog?.id
      });
      trackMealLogLifecycleEvent({
        userId: ctx.user.id,
        mealLogCount,
        effortLevel: input.log.effortLevel,
        source: input.source === "log_again" ? "log_again" : "quick_log"
      });

      // Milestone notifications — first + second meal are activation
      // signals worth surfacing in the bell. Fire-and-forget: a logging
      // failure here MUST NOT bubble up and make the log appear failed.
      if (mealLogCount === 1 || mealLogCount === 2) {
        const milestone =
          mealLogCount === 1
            ? {
                title: "First meal logged",
                body: "eeatly will get more useful with every log. Tap to see your kitchen.",
                href: "/dashboard"
              }
            : {
                title: "Two cooks logged",
                body: "Once you log a few more, eeatly starts surfacing what's worth cooking again.",
                href: "/ideas"
              };
        void createNotification({
          userId: ctx.user.id,
          type: "system",
          ...milestone
        }).catch((error) => {
          logger.warn("milestone_notification_failed", {
            userId: ctx.user.id,
            milestone: mealLogCount === 1 ? "first_meal" : "second_meal",
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }

      return { mealLog: { id: mealLog?.id } };
    }),

  /**
   * Soft-delete a meal log (the row stays for audit / "former member"
   * preservation; UI just hides it). Service-level authz: household
   * member can delete any log in the household — see comment in
   * `services/meals.ts:deleteMealLog`.
   */
  deleteLog: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMealLog(ctx.user.id, ctx.household.id, input.logId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        if (message.toLowerCase().includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message,
            cause: { reason: "LOG_NOT_FOUND" }
          });
        }
        throw error;
      }
      revalidatePath("/dashboard");
      revalidatePath("/history");
      revalidatePath("/ideas");
      logger.info("meal_log_deleted", {
        userId: ctx.user.id,
        householdId: ctx.household.id,
        logId: input.logId
      });
      return { ok: true as const };
    })
});
