"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import { trackMealLogLifecycleEvent } from "@/lib/observability/funnel";
import { logger } from "@/lib/observability/logger";
import { checkMealMutationLimit } from "@/lib/security/rate-limit";
import {
  createMealLog,
  deleteMealLog,
  getDashboardMeals,
  getHistoryRows,
  type HistoryListOptions
} from "@/services/meals";
import type { MealLogInput } from "@/lib/validators/meals";

export async function getDashboardMealsAction(options?: {
  suggestionLimit?: number;
  recentMealsLimit?: number;
}) {
  const user = await requireCurrentUser();

  return getDashboardMeals(user.id, options);
}

export async function getHistoryRowsAction(options?: HistoryListOptions) {
  const user = await requireCurrentUser();
  return getHistoryRows(user.id, options);
}

export async function createMealLogAction(
  input: MealLogInput,
  options?: { source?: "quick_log" | "log_again" }
) {
  const user = await requireCurrentUser();
  await checkMealMutationLimit(user.id);

  const { mealLog, mealLogCount } = await createMealLog(user.id, input);

  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/ideas");
  logger.info("meal_log_created", { userId: user.id, mealLogId: mealLog?.id });
  trackMealLogLifecycleEvent({
    userId: user.id,
    mealLogCount,
    effortLevel: input.effortLevel,
    source: options?.source === "log_again" ? "log_again" : "quick_log"
  });

  return { mealLog: { id: mealLog?.id } };
}

export async function deleteMealLogAction(logId: string): Promise<void> {
  const user = await requireCurrentUser();
  await checkMealMutationLimit(user.id);
  await deleteMealLog(user.id, logId);
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/ideas");
  logger.info("meal_log_deleted", { userId: user.id, logId });
}
