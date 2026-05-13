"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMealLogAction, deleteMealLogAction, getDashboardMealsAction } from "@/actions/meals";
import { queryKeys } from "@/lib/query/keys";
import type { MealLogInput } from "@/lib/validators/meals";
import type { DashboardMeals, MealStat, RecentMeal } from "@/types";

export function useDashboardMeals(initialData?: DashboardMeals) {
  return useQuery({
    queryKey: queryKeys.meals.dashboard(),
    queryFn: getDashboardMealsAction,
    staleTime: 30_000,
    initialData
  });
}

export function useCreateMealLog(options?: { source?: "quick_log" | "log_again" }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MealLogInput) => createMealLogAction(input, options),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.meals.dashboard() });
      const previous = queryClient.getQueryData<DashboardMeals>(queryKeys.meals.dashboard());

      if (previous) {
        const optimisticRecentMeal: RecentMeal = {
          id: `optimistic-${Date.now()}`,
          mealId: `optimistic-meal-${Date.now()}`,
          mealName: input.mealName,
          cookedAt: input.cookedDate,
          effortLevel: input.effortLevel,
          notes: input.notes || null,
          photoUrl: input.photoUrl || null
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

        queryClient.setQueryData<DashboardMeals>(queryKeys.meals.dashboard(), {
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
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.meals.dashboard(), context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.all });
    }
  });
}

export function useDeleteMealLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => deleteMealLogAction(logId),
    onMutate: async (logId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.meals.dashboard() });
      const previous = queryClient.getQueryData<DashboardMeals>(queryKeys.meals.dashboard());

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

        queryClient.setQueryData<DashboardMeals>(queryKeys.meals.dashboard(), {
          ...previous,
          recentMeals: previous.recentMeals.filter((m) => m.id !== logId),
          mostCookedMeals: updateStats(previous.mostCookedMeals),
          neglectedMeals: updateStats(previous.neglectedMeals)
        });
      }

      return { previous };
    },
    onError: (_error, _logId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.meals.dashboard(), context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.all });
    }
  });
}
