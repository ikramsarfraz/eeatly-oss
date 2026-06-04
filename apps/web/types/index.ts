// Round 12 — literal enums moved to `@eeatly/api/enums` so both web and
// mobile share the same source of truth. Re-exported here to keep the
// existing `@/types` import surface intact for web call-sites.
import type { EffortLevel, UserRole, TenantRole, BetaCohort } from "@eeatly/api";
export type { EffortLevel, UserRole, TenantRole, BetaCohort };

export type RecentMeal = {
  id: string;
  mealId: string;
  mealName: string;
  cookedAt: string;
  effortLevel: EffortLevel;
  notes: string | null;
  photoUrl: string | null;
  /**
   * Round-4 attribution: who logged this cook. Both null when the cook's
   * account has been deleted — the log survives via `ON DELETE SET NULL`
   * (Round 4.7 / migration 0017) so household history stays intact, and
   * the UI renders "Former member" in place of the name.
   */
  cookedByUserId: string | null;
  cookedByName: string | null;
};

export type MealStat = {
  mealId: string;
  mealName: string;
  cookCount: number;
  lastCookedAt: string | null;
  photoUrl: string | null;
  recipeText: string | null;
  recipeSourceUrl: string | null;
};

export type RediscoverySuggestion = {
  id: string;
  mealId: string;
  mealName: string;
  reason: "neglected" | "frequent" | "quick" | "favorite";
  title: string;
  description: string;
  lastCookedAt: string | null;
  daysSinceCooked: number | null;
  effortLevel: EffortLevel | null;
  photoUrl: string | null;
};

export type ShareActionResult =
  | { ok: true; text: string }
  | {
      ok: false;
      // Round 6: added UPGRADE_REQUIRED for the paid-tier gate. `feature`
      // is populated only on that branch so the UI knows which prompt to
      // render.
      code: "RECIPE_MISSING" | "RATE_LIMITED" | "AI_ERROR" | "UPGRADE_REQUIRED";
      message: string;
      feature?: string;
    };

export type MealSuggestion = {
  name: string;
  effortGuess: "quick" | "easy" | "medium" | "high_effort";
  notes: string;
  recipeText: string;
  confidence: "high" | "medium" | "low";
  // Round 10: ordered list of ingredient lines as the AI extracted them.
  // Empty array when the source has no parseable ingredients (a photo of
  // a finished dish, a recipe-less voice note, etc.). Optional so older
  // call-sites and legacy provider responses still typecheck.
  ingredients?: string[];
  // Free-form yield/servings, e.g. "Serves 4" / "Makes 8 sliders". Empty
  // string when the source doesn't state a yield. Optional for back-compat.
  servings?: string;
};

export type DashboardMeals = {
  recentMeals: RecentMeal[];
  mostCookedMeals: MealStat[];
  neglectedMeals: MealStat[];
  suggestions: RediscoverySuggestion[];
};
