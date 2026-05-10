import { differenceInCalendarDays, parseISO } from "date-fns";
import type { DashboardMeals, EffortLevel, MealStat, RecentMeal, RediscoverySuggestion } from "@/types";

const horizon = () => new Date();

function daysSince(value: string | null) {
  if (!value) {
    return null;
  }

  return Math.max(0, differenceInCalendarDays(horizon(), parseISO(value)));
}

function rankScore(days: number | null, cookCount: number) {
  const d = days ?? 120;
  const repeatWeight = Math.min(Math.sqrt(cookCount), 8) * 6;
  const recencyPenalty = d <= 2 ? -55 : d <= 5 ? -32 : d <= 9 ? -12 : 0;
  const timeScore = Math.min(d, 180) * 1.65;

  return repeatWeight + timeScore + recencyPenalty;
}

function classifyCopy(
  days: number | null,
  cookCount: number,
  effort?: EffortLevel | null
): Pick<
  RediscoverySuggestion,
  "reason" | "title" | "description" | "daysSinceCooked" | "effortLevel"
> {
  if (days !== null && cookCount >= 3 && days >= 32) {
    return {
      reason: "favorite",
      title: "Bring back a household favorite",
      description: `You’ve cooked this ${cookCount} times, yet it hasn’t surfaced in ${days} days.`,
      daysSinceCooked: days,
      effortLevel: effort ?? null
    };
  }

  if (days !== null && cookCount >= 4 && days >= 10 && days <= 21) {
    return {
      reason: "frequent",
      title: "Trusted rotation pick",
      description:
        `${cookCount} logged cooks—it is a standby. Long enough ago to feel fresh again.`,
      daysSinceCooked: days,
      effortLevel: effort ?? null
    };
  }

  if (days !== null && days >= 21) {
    return {
      reason: "neglected",
      title: "You haven’t leaned on this lately",
      description: `About ${days} days since your last bowl or plate.`,
      daysSinceCooked: days,
      effortLevel: effort ?? null
    };
  }

  if (effort === "quick" && cookCount >= 2) {
    return {
      reason: "quick",
      title: "Quick win from history",
      description: "A faster option pulled from nights you actually finished.",
      daysSinceCooked: days,
      effortLevel: effort
    };
  }

  return {
    reason: "frequent",
    title: "Familiar favorite",
    description: `${cookCount} cooks logged—worth keeping nearby.`,
    daysSinceCooked: days,
    effortLevel: effort ?? null
  };
}

export function buildRediscoverySuggestions(
  stats: MealStat[],
  recentMeals: RecentMeal[]
): RediscoverySuggestion[] {
  const lastEffortByMeal = new Map<string, RecentMeal["effortLevel"]>(
    recentMeals.map((log) => [log.mealId, log.effortLevel])
  );

  const ranked = stats
    .map((meal) => {
      const days = daysSince(meal.lastCookedAt);
      const effortLevel = lastEffortByMeal.get(meal.mealId) ?? null;

      const score = rankScore(days, meal.cookCount);

      const copyBase = classifyCopy(days, meal.cookCount, effortLevel);

      return {
        mealId: meal.mealId,
        mealName: meal.mealName,
        lastCookedAt: meal.lastCookedAt,
        photoUrl: meal.photoUrl,
        rank: score,
        ...copyBase
      };
    })
    .sort((a, b) => {
      const diff = b.rank - a.rank;

      if (diff !== 0) {
        return diff;
      }

      const bDays = b.daysSinceCooked ?? 0;
      const aDays = a.daysSinceCooked ?? 0;

      return bDays - aDays;
    })
    .slice(0, 4);

  return ranked.map((meal, index) => ({
    mealId: meal.mealId,
    mealName: meal.mealName,
    reason: meal.reason,
    title: meal.title,
    description: meal.description,
    lastCookedAt: meal.lastCookedAt,
    daysSinceCooked: meal.daysSinceCooked,
    effortLevel: meal.effortLevel,
    photoUrl: meal.photoUrl,
    id: `${meal.mealId}-${meal.reason}-${index}`
  }));
}

export function withSuggestions(
  recentMeals: RecentMeal[],
  mostCookedMeals: MealStat[],
  neglectedMeals: MealStat[]
): DashboardMeals {
  const mergedStats = [...neglectedMeals, ...mostCookedMeals];
  const uniqueStats = Array.from(new Map(mergedStats.map((m) => [m.mealId, m])).values());

  return {
    recentMeals,
    mostCookedMeals,
    neglectedMeals,
    suggestions: buildRediscoverySuggestions(uniqueStats, recentMeals)
  };
}
