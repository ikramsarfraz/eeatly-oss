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
};

export type MealStat = {
  mealId: string;
  mealName: string;
  cookCount: number;
  lastCookedAt: string;
  photoUrl: string | null;
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

export type DashboardMeals = {
  recentMeals: RecentMeal[];
  mostCookedMeals: MealStat[];
  neglectedMeals: MealStat[];
  suggestions: RediscoverySuggestion[];
};
