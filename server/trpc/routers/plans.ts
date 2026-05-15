import "server-only";

import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import {
  addDishToPlanSchema,
  clonePlanSchema,
  createPlanSchema,
  removeDishFromPlanSchema,
  reorderDishesSchema,
  updateDishAnnotationSchema,
  updatePlanSchema
} from "@/lib/validators/plans";
import {
  addDishToPlan,
  archivePlan,
  clonePlanFromPast,
  createPlan,
  getPlan,
  getPlanAnnotationsByMealId,
  getPlanEffortAggregate,
  listMealLibrary,
  listPlansForHousehold,
  removeDishFromPlan,
  reorderDishes,
  unarchivePlan,
  updateDishAnnotation,
  updatePlan
} from "@/services/plans";
import { householdMemberProcedure, rateLimit, router } from "../trpc";

/**
 * Round 11 — service errors map to TRPCError codes. The old action
 * layer parsed error messages to distinguish "not found" / "archived"
 * / "cross household" branches. Keep the same translation so the UI
 * patterns from Round 5 don't regress.
 */
function mapPlanServiceError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof FeatureGateDeniedError) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: { reason: "UPGRADE_REQUIRED", feature: error.feature }
    });
  }
  const message = error instanceof Error ? error.message : "Unknown error.";
  const lower = message.toLowerCase();
  if (lower.includes("not in this household")) {
    return new TRPCError({
      code: "NOT_FOUND",
      message,
      cause: { reason: "CROSS_HOUSEHOLD" }
    });
  }
  if (lower.includes("archived")) {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message,
      cause: { reason: "MEAL_ARCHIVED" }
    });
  }
  if (lower.includes("not found")) {
    return new TRPCError({
      code: "NOT_FOUND",
      message,
      cause: { reason: "NOT_FOUND" }
    });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
}

/**
 * Round 11 — plan reads.
 *
 * `list` returns the household's plans with dish counts.
 * `getById` returns the plan + dishes + annotations.
 * `effortAggregate` is split out because the plan-detail page fires
 * it in parallel with `getById` today and we want to preserve that
 * shape (mobile can fan-out the same way).
 * `previousAnnotationsByMeal` powers the hint-badge surface on a
 * cloned plan (Round 5).
 * `mealLibrary` powers the "add dish" picker — substring `q` filter
 * over the household's meal names.
 */
export const plansRouter = router({
  list: householdMemberProcedure
    .input(z.object({ includeArchived: z.boolean().optional() }).optional())
    .query(({ ctx, input }) =>
      listPlansForHousehold({
        userId: ctx.user.id,
        householdId: ctx.household.id,
        includeArchived: input?.includeArchived
      })
    ),

  getById: householdMemberProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(({ ctx, input }) => getPlan({ planId: input.planId, userId: ctx.user.id })),

  effortAggregate: householdMemberProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      getPlanEffortAggregate({ planId: input.planId, userId: ctx.user.id })
    ),

  previousAnnotationsByMeal: householdMemberProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      getPlanAnnotationsByMealId({ planId: input.planId, userId: ctx.user.id })
    ),

  mealLibrary: householdMemberProcedure
    .input(
      z.object({
        q: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(100).optional()
      })
    )
    .query(({ ctx, input }) =>
      listMealLibrary({
        userId: ctx.user.id,
        householdId: ctx.household.id,
        q: input.q,
        limit: input.limit
      })
    ),

  /**
   * Round 11 — plan mutations. Each composes the shared
   * `householdMemberProcedure` (auth + household scope) with the
   * meal-mutation rate limit. The `plans_create` / `plans_clone`
   * feature gates live inside the underlying services
   * (`createPlan`, `clonePlanFromPast`) — those still throw
   * `FeatureGateDeniedError`, which `mapPlanServiceError` translates
   * to FORBIDDEN + `cause: { reason: "UPGRADE_REQUIRED", feature }`.
   *
   * `revalidatePath` calls preserve SSR cache freshness for the
   * server-rendered plan pages — they live inside the procedure so
   * the mobile client gets correct behavior too (the path
   * invalidates regardless of who called).
   */
  create: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(createPlanSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const plan = await createPlan({
          householdId: ctx.household.id,
          userId: ctx.user.id,
          name: input.name,
          scheduledDate: input.scheduledDate,
          notes: input.notes
        });
        revalidatePath("/plans");
        return { planId: plan.id };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  update: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ planId: z.string().uuid(), patch: updatePlanSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePlan({
          planId: input.planId,
          userId: ctx.user.id,
          patch: input.patch
        });
        revalidatePath("/plans");
        revalidatePath(`/plans/${input.planId}`);
        return { ok: true as const };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  archive: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await archivePlan({ planId: input.planId, userId: ctx.user.id });
        revalidatePath("/plans");
        revalidatePath(`/plans/${input.planId}`);
        return { ok: true as const };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  unarchive: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await unarchivePlan({ planId: input.planId, userId: ctx.user.id });
        revalidatePath("/plans");
        revalidatePath(`/plans/${input.planId}`);
        return { ok: true as const };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  addDish: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ planId: z.string().uuid(), dish: addDishToPlanSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dish = await addDishToPlan({
          planId: input.planId,
          userId: ctx.user.id,
          mealId: input.dish.mealId
        });
        revalidatePath(`/plans/${input.planId}`);
        return { planDishId: dish.id };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  removeDish: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(
      z.object({ planId: z.string().uuid(), dish: removeDishFromPlanSchema })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await removeDishFromPlan({
          planId: input.planId,
          userId: ctx.user.id,
          planDishId: input.dish.planDishId
        });
        revalidatePath(`/plans/${input.planId}`);
        return { ok: true as const };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  reorderDishes: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ planId: z.string().uuid(), order: reorderDishesSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await reorderDishes({
          planId: input.planId,
          userId: ctx.user.id,
          dishIdsInOrder: input.order.dishIdsInOrder
        });
        revalidatePath(`/plans/${input.planId}`);
        return { ok: true as const };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  updateDishAnnotation: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(
      z.object({
        planDishId: z.string().uuid(),
        patch: updateDishAnnotationSchema
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await updateDishAnnotation({
          planDishId: input.planDishId,
          userId: ctx.user.id,
          patch: input.patch
        });
        revalidatePath(`/plans/${updated.planId}`);
        return { ok: true as const };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    }),

  cloneFromPast: householdMemberProcedure
    .use(rateLimit("mutation"))
    .input(clonePlanSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await clonePlanFromPast({
          sourcePlanId: input.sourcePlanId,
          userId: ctx.user.id,
          newName: input.newName,
          newScheduledDate: input.newScheduledDate
        });
        revalidatePath("/plans");
        return {
          newPlanId: result.newPlanId,
          previousAnnotations: result.previousAnnotations
        };
      } catch (error) {
        throw mapPlanServiceError(error);
      }
    })
});
