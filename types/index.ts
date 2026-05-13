export type EffortLevel = "quick" | "easy" | "medium" | "high_effort";

export type UserRole = "root_app_user" | "tenant_user" | "platform_admin";

export type TenantRole = "owner" | "admin" | "member";

export type BetaCohort = "alpha" | "beta_wave_1" | "beta_wave_2" | "internal";

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
  | { ok: false; code: "RECIPE_MISSING" | "RATE_LIMITED" | "AI_ERROR"; message: string };

export type MealSuggestion = {
  name: string;
  effortGuess: "quick" | "easy" | "medium" | "high_effort";
  notes: string;
  recipeText: string;
  confidence: "high" | "medium" | "low";
};

export type DashboardMeals = {
  recentMeals: RecentMeal[];
  mostCookedMeals: MealStat[];
  neglectedMeals: MealStat[];
  suggestions: RediscoverySuggestion[];
};
