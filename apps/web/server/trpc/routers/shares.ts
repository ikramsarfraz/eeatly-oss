import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import { logger } from "@/lib/observability/logger";
import {
  createRecipeShareSchema,
  revokeRecipeShareSchema
} from "@eeatly/api/validators/shares";
import {
  createRecipeShare,
  getRecipeShareByToken,
  listSharesForHousehold,
  listSharesForMeal,
  revokeRecipeShare
} from "@/services/shares";
import {
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router,
  householdMemberProcedure
} from "../trpc";

/**
 * Round 11 — share reads.
 *
 * `listForMeal` / `listForHousehold` power the "manage shares" UI.
 * `getByToken` is public — bearer-token access to the share-page
 * payload; matches the existing public surface in /app/share/[token].
 */
export const sharesRouter = router({
  listForMeal: householdMemberProcedure
    .input(z.object({ mealId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      listSharesForMeal({ userId: ctx.user.id, mealId: input.mealId })
    ),

  listForHousehold: householdMemberProcedure.query(({ ctx }) =>
    listSharesForHousehold({ userId: ctx.user.id, householdId: ctx.household.id })
  ),

  getByToken: publicProcedure
    .input(z.object({ token: z.string().min(8).max(256) }))
    .query(({ input }) => getRecipeShareByToken({ token: input.token })),

  /**
   * Round 11 — create / revoke share links. The Round 7 service is
   * idempotent per (meal, non-revoked) — re-clicking returns the
   * existing share. Rate limit uses the dedicated `share` bucket
   * (20/day) so spam doesn't drain the meal-mutation budget.
   *
   * Authz quirk: `protectedProcedure` rather than
   * `householdMemberProcedure` for `create` — the service does its
   * own `meals.householdId == requestor` check via the user lookup,
   * and the input only carries `mealId`. Adding the household
   * middleware would force the caller to send a redundant
   * `householdId` that the service ignores.
   */
  create: protectedProcedure
    .use(rateLimit("share"))
    .input(createRecipeShareSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createRecipeShare({
          userId: ctx.user.id,
          mealId: input.mealId
        });
      } catch (error) {
        if (error instanceof FeatureGateDeniedError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
            cause: { reason: "UPGRADE_REQUIRED", feature: error.feature }
          });
        }
        const message = error instanceof Error ? error.message : "Unknown error.";
        const lower = message.toLowerCase();
        if (lower.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message,
            cause: { reason: "NOT_FOUND" }
          });
        }
        if (lower.includes("archived")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message,
            cause: { reason: "MEAL_ARCHIVED" }
          });
        }
        logger.warn("share_create_failed", { userId: ctx.user.id, error: message });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't create share link."
        });
      }
    }),

  revoke: protectedProcedure
    .input(revokeRecipeShareSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeRecipeShare({
          userId: ctx.user.id,
          shareId: input.shareId
        });
        return { ok: true as const };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        if (message.toLowerCase().includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message,
            cause: { reason: "NOT_FOUND" }
          });
        }
        throw error;
      }
    }),

  /**
   * Convenience: read the SINGLE active share for a meal (the dialog
   * surfaces "Create" or "Active" branches off this). The reads
   * router already exposes `listForMeal`; this is a thin one-row
   * specialization the share dialog used as `getShareForMealAction`.
   * Returns `null` when there's no active share — same shape the old
   * action used.
   */
  activeForMeal: householdMemberProcedure
    .input(z.object({ mealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await listSharesForMeal({
        userId: ctx.user.id,
        mealId: input.mealId
      });
      if (rows.length === 0) return null;
      const head = rows[0]!;
      return { shareId: head.id, url: head.url };
    })
});
