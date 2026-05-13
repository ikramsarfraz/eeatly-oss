"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
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
import { createNotification } from "@/services/notifications";
import type { MealLogInput } from "@/lib/validators/meals";

export async function getDashboardMealsAction(options?: {
  suggestionLimit?: number;
  recentMealsLimit?: number;
}) {
  const { user, household } = await requireCurrentUserWithHousehold();
  return getDashboardMeals(user.id, household.id, options);
}

export async function getHistoryRowsAction(options?: HistoryListOptions) {
  const { user, household } = await requireCurrentUserWithHousehold();
  return getHistoryRows(user.id, household.id, options);
}

export async function createMealLogAction(
  input: MealLogInput,
  options?: { source?: "quick_log" | "log_again" }
) {
  const { user, household } = await requireCurrentUserWithHousehold();
  await checkMealMutationLimit(user.id);

  const { mealLog, mealLogCount } = await createMealLog(user.id, household.id, input);

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

  // Milestone notifications — first and second meal are activation
  // signals worth surfacing in the bell. Fire-and-forget so the create
  // path doesn't block on the notification write; log + swallow on
  // failure (the user got the meal logged either way).
  if (mealLogCount === 1) {
    void createNotification({
      userId: user.id,
      type: "system",
      title: "First meal logged",
      body: "eeatly will get more useful with every log. Tap to see your kitchen.",
      href: "/dashboard"
    }).catch((error) => {
      logger.warn("milestone_notification_failed", {
        userId: user.id,
        milestone: "first_meal",
        error: error instanceof Error ? error.message : String(error)
      });
    });
  } else if (mealLogCount === 2) {
    void createNotification({
      userId: user.id,
      type: "system",
      title: "Two cooks logged",
      body: "Once you log a few more, eeatly starts surfacing what's worth cooking again.",
      href: "/ideas"
    }).catch((error) => {
      logger.warn("milestone_notification_failed", {
        userId: user.id,
        milestone: "second_meal",
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  return { mealLog: { id: mealLog?.id } };
}

export async function deleteMealLogAction(logId: string): Promise<void> {
  const { user, household } = await requireCurrentUserWithHousehold();
  await checkMealMutationLimit(user.id);
  await deleteMealLog(user.id, household.id, logId);
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/ideas");
  logger.info("meal_log_deleted", {
    userId: user.id,
    householdId: household.id,
    logId
  });
}
