import "server-only";

import { z } from "zod";
import { getDashboardMeals } from "@/services/meals";
import { householdMemberProcedure, router } from "../trpc";

/**
 * Round 11 — dashboard reads. One procedure today; the existing
 * `getDashboardMeals` service already returns the four-segment shape
 * the UI uses (`recentMeals`, `mostCookedMeals`, `neglectedMeals`,
 * `suggestions`). Splitting into four sub-queries would mean four
 * separate DB round-trips per dashboard render — keep it merged for
 * now. The mobile app can call this same procedure as-is.
 */
const dashboardInputSchema = z.object({
  suggestionLimit: z.number().int().min(0).max(48).optional(),
  recentMealsLimit: z.number().int().min(1).max(50).optional()
});

export const dashboardRouter = router({
  meals: householdMemberProcedure
    .input(dashboardInputSchema.optional())
    .query(({ ctx, input }) =>
      getDashboardMeals(ctx.user.id, ctx.household.id, input)
    )
});
