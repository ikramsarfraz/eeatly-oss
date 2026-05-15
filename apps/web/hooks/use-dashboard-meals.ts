"use client";

import { trpc } from "@/lib/trpc/client";
import type { MealLogInput } from "@/lib/validators/meals";
import type { MealStat, RecentMeal } from "@/types";

/**
 * Round 11 — every read and mutation flows through tRPC. Optimistic
 * cache writes target the `trpc.dashboard.meals` query key via the
 * `utils` helper; the wrapper preserves the Round 10 UX (immediate
 * recent-meal + most-cooked update on mutate, snap-back on error).
 *
 * The `mutateAsync` shape exposed by the underlying hook is the
 * imperative call site for forms / log-again buttons — the existing
 * call sites used a TanStack `useMutation` whose `mutateAsync`
 * returned the action's result; tRPC's hook gives the same surface
 * back, so call sites don't need to change shape.
 */
export function useDashboardMeals(initialData?: Parameters<typeof trpc.dashboard.meals.useQuery>[1] extends infer Q
  ? Q extends { initialData?: infer T }
    ? T
    : never
  : never) {
  return trpc.dashboard.meals.useQuery(undefined, {
    staleTime: 30_000,
    initialData
  });
}

export function useCreateMealLog(options?: {
  source?: "quick_log" | "log_again";
  /**
   * Current user info for the optimistic row's attribution fields. The
   * renderer hides "by X" when cookedByUserId matches the viewer — passing
   * the viewer's id keeps the optimistic row clean. Optional: when omitted,
   * the optimistic row uses an empty userId, which means the renderer will
   * try to render an empty "by " until the server response invalidates.
   */
  cookedBy?: { userId: string; name: string };
}) {
  const utils = trpc.useUtils();

  return trpc.meals.createLog.useMutation({
    onMutate: async (variables) => {
      const input = variables.log;
      await utils.dashboard.meals.cancel();
      const previous = utils.dashboard.meals.getData();

      if (previous) {
        const optimisticRecentMeal: RecentMeal = {
          id: `optimistic-${Date.now()}`,
          mealId: `optimistic-meal-${Date.now()}`,
          mealName: input.mealName,
          cookedAt: input.cookedDate,
          effortLevel: input.effortLevel,
          notes: input.notes || null,
          photoUrl: input.photoUrl || null,
          cookedByUserId: options?.cookedBy?.userId ?? "",
          cookedByName: options?.cookedBy?.name ?? ""
        };

        const existingStat = previous.mostCookedMeals.find(
          (meal) => meal.mealName.toLowerCase() === input.mealName.toLowerCase()
        );
        const optimisticStat: MealStat = existingStat
          ? {
              ...existingStat,
              cookCount: existingStat.cookCount + 1,
              lastCookedAt: input.cookedDate,
              photoUrl: existingStat.photoUrl ?? input.photoUrl ?? null
            }
          : {
              mealId: optimisticRecentMeal.mealId,
              mealName: input.mealName,
              cookCount: 1,
              lastCookedAt: input.cookedDate,
              photoUrl: input.photoUrl || null,
              recipeText: null,
              recipeSourceUrl: null
            };

        utils.dashboard.meals.setData(undefined, {
          ...previous,
          recentMeals: [optimisticRecentMeal, ...previous.recentMeals].slice(0, 10),
          mostCookedMeals: [
            optimisticStat,
            ...previous.mostCookedMeals.filter(
              (meal) => meal.mealName.toLowerCase() !== input.mealName.toLowerCase()
            )
          ].slice(0, 6)
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        utils.dashboard.meals.setData(undefined, context.previous);
      }
    },
    onSettled: async () => {
      await utils.dashboard.meals.invalidate();
    }
  });
}

/**
 * Imperative helper for call sites that still want `mutateAsync(input)`
 * with just the `MealLogInput` payload — wraps the source flag this
 * hook was instantiated with so call sites don't have to thread it
 * through every call. Returns the underlying mutation object so
 * callers can read `.isPending`, etc.
 */
export function useCreateMealLogImperative(options?: {
  source?: "quick_log" | "log_again";
  cookedBy?: { userId: string; name: string };
}) {
  const mutation = useCreateMealLog(options);
  return {
    ...mutation,
    mutateAsync: (input: MealLogInput) =>
      mutation.mutateAsync({ log: input, source: options?.source })
  };
}

export function useDeleteMealLog() {
  const utils = trpc.useUtils();

  return trpc.meals.deleteLog.useMutation({
    onMutate: async (variables) => {
      const { logId } = variables;
      await utils.dashboard.meals.cancel();
      const previous = utils.dashboard.meals.getData();

      if (previous) {
        const deletedLog = previous.recentMeals.find((m) => m.id === logId);

        const updateStats = (stats: MealStat[]) => {
          if (!deletedLog) return stats;
          return stats
            .map((m) =>
              m.mealId === deletedLog.mealId ? { ...m, cookCount: m.cookCount - 1 } : m
            )
            .filter((m) => m.cookCount > 0);
        };

        utils.dashboard.meals.setData(undefined, {
          ...previous,
          recentMeals: previous.recentMeals.filter((m) => m.id !== logId),
          mostCookedMeals: updateStats(previous.mostCookedMeals),
          neglectedMeals: updateStats(previous.neglectedMeals)
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        utils.dashboard.meals.setData(undefined, context.previous);
      }
    },
    onSettled: async () => {
      await utils.dashboard.meals.invalidate();
    }
  });
}
