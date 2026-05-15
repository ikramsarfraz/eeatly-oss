import { differenceInCalendarDays } from "date-fns";

export type RetentionStatus = "new_user" | "activated" | "engaged" | "at_risk" | "inactive";

export type RetentionStatusInput = {
  signupAt: Date;
  mealCount: number;
  lastMealLogAt: Date | null;
  now?: Date;
};

/**
 * Computes an operational retention label for admins and lifecycle filters.
 * Activity is meal-log based (last persisted log timestamp).
 *
 * Order: inactive → new_user → at_risk → engaged → activated
 */
export function computeRetentionStatus(input: RetentionStatusInput): RetentionStatus {
  const now = input.now ?? new Date();
  const signup = input.signupAt;
  const mealCount = input.mealCount;
  const lastMeal = input.lastMealLogAt;

  const daysSinceSignup = differenceInCalendarDays(now, signup);
  const daysSinceMeal = lastMeal ? differenceInCalendarDays(now, lastMeal) : null;

  const neverCookedLongIdle = mealCount === 0 && daysSinceSignup > 14;
  const churnedCook = mealCount > 0 && daysSinceMeal !== null && daysSinceMeal > 14;

  if (neverCookedLongIdle || churnedCook) {
    return "inactive";
  }

  const isNewWindow = daysSinceSignup <= 7 && mealCount <= 1;
  if (isNewWindow) {
    return "new_user";
  }

  if (mealCount > 0 && daysSinceMeal !== null && daysSinceMeal >= 7) {
    return "at_risk";
  }

  if (mealCount >= 3 && daysSinceMeal !== null && daysSinceMeal <= 7) {
    return "engaged";
  }

  if (mealCount >= 2 && daysSinceMeal !== null && daysSinceMeal <= 2) {
    return "engaged";
  }

  if (mealCount >= 1 && daysSinceMeal !== null && daysSinceMeal < 7) {
    return "activated";
  }

  if (mealCount === 0 && daysSinceSignup <= 14) {
    return "new_user";
  }

  return "at_risk";
}

export const RETENTION_STATUS_LABELS: Record<RetentionStatus, string> = {
  new_user: "New",
  activated: "Activated",
  engaged: "Engaged",
  at_risk: "At risk",
  inactive: "Inactive"
};

export type AdminUserSegmentFilter = "all" | RetentionStatus;

export function parseSegmentFilter(value: string | undefined): AdminUserSegmentFilter {
  if (!value || value === "all") {
    return "all";
  }

  if (value === "new" || value === "new_user") {
    return "new_user";
  }

  if (value === "at-risk" || value === "at_risk") {
    return "at_risk";
  }

  if (
    value === "activated" ||
    value === "engaged" ||
    value === "inactive"
  ) {
    return value;
  }

  return "all";
}
