import { describe, expect, it } from "vitest";
import { buildRediscoverySuggestions, withSuggestions } from "./rediscovery";
import type { MealStat, RecentMeal } from "@/types";

function stat(overrides: Partial<MealStat> = {}): MealStat {
  return {
    mealId: overrides.mealId ?? `meal-${Math.random()}`,
    mealName: overrides.mealName ?? "Soy ginger noodles",
    cookCount: overrides.cookCount ?? 3,
    lastCookedAt: overrides.lastCookedAt ?? "2026-04-15",
    photoUrl: overrides.photoUrl ?? null,
    recipeText: overrides.recipeText ?? null,
    recipeSourceUrl: overrides.recipeSourceUrl ?? null
  };
}

function recent(overrides: Partial<RecentMeal> = {}): RecentMeal {
  return {
    id: overrides.id ?? `log-${Math.random()}`,
    mealId: overrides.mealId ?? `meal-${Math.random()}`,
    mealName: overrides.mealName ?? "Soy ginger noodles",
    cookedAt: overrides.cookedAt ?? "2026-05-10",
    effortLevel: overrides.effortLevel ?? "easy",
    notes: overrides.notes ?? null,
    photoUrl: overrides.photoUrl ?? null
  };
}

describe("buildRediscoverySuggestions", () => {
  it("returns an empty array when given no stats", () => {
    expect(buildRediscoverySuggestions([], [])).toEqual([]);
  });

  it("respects the default limit of 24", () => {
    const stats = Array.from({ length: 40 }, (_, i) =>
      stat({ mealId: `m-${i}`, mealName: `Meal ${i}`, lastCookedAt: "2026-03-01" })
    );
    expect(buildRediscoverySuggestions(stats, [])).toHaveLength(24);
  });

  it("respects a caller-supplied limit", () => {
    const stats = Array.from({ length: 10 }, (_, i) =>
      stat({ mealId: `m-${i}`, mealName: `Meal ${i}`, lastCookedAt: "2026-03-01" })
    );
    expect(buildRediscoverySuggestions(stats, [], 3)).toHaveLength(3);
  });

  it("treats limit 0 as zero suggestions", () => {
    expect(buildRediscoverySuggestions([stat()], [], 0)).toEqual([]);
  });

  it("clamps negative limits to zero", () => {
    expect(buildRediscoverySuggestions([stat()], [], -5)).toEqual([]);
  });

  it("labels a 3+-cook meal not seen in 32+ days as 'favorite'", () => {
    const meal = stat({
      mealId: "m-fav",
      mealName: "Mushroom orzotto",
      cookCount: 4,
      lastCookedAt: "2026-03-01"
    });
    // 32+ days before "now" — using a fixed comparison day in the description
    const result = buildRediscoverySuggestions([meal], []);
    expect(result[0]?.reason).toBe("favorite");
    expect(result[0]?.title).toMatch(/favorite/i);
  });

  it("labels a 21+-day-stale meal with low cook count as 'neglected'", () => {
    const meal = stat({
      mealId: "m-neg",
      mealName: "Smashed cucumber",
      cookCount: 1,
      lastCookedAt: "2026-04-01"
    });
    const result = buildRediscoverySuggestions([meal], []);
    expect(result[0]?.reason).toBe("neglected");
  });

  it("includes the photoUrl in the output when present", () => {
    const meal = stat({
      mealId: "m-photo",
      photoUrl: "https://example.com/photo.jpg",
      lastCookedAt: "2026-04-01"
    });
    const [suggestion] = buildRediscoverySuggestions([meal], []);
    expect(suggestion?.photoUrl).toBe("https://example.com/photo.jpg");
  });

  it("attaches effort from the most-recent log of the same meal", () => {
    const meal = stat({ mealId: "m-1", lastCookedAt: "2026-04-01" });
    const log = recent({ mealId: "m-1", effortLevel: "quick" });
    const [suggestion] = buildRediscoverySuggestions([meal], [log]);
    expect(suggestion?.effortLevel).toBe("quick");
  });

  it("generates stable unique ids per suggestion", () => {
    const stats = [
      stat({ mealId: "m-a", lastCookedAt: "2026-04-01" }),
      stat({ mealId: "m-b", lastCookedAt: "2026-03-01" })
    ];
    const result = buildRediscoverySuggestions(stats, []);
    const ids = result.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("withSuggestions", () => {
  it("preserves the source lists and attaches suggestions", () => {
    const recent1 = recent({ id: "log-1", mealId: "m-1" });
    const most = stat({ mealId: "m-1", cookCount: 5, lastCookedAt: "2026-04-15" });
    const neglected = stat({ mealId: "m-2", cookCount: 1, lastCookedAt: "2026-03-01" });

    const result = withSuggestions([recent1], [most], [neglected]);
    expect(result.recentMeals).toEqual([recent1]);
    expect(result.mostCookedMeals).toEqual([most]);
    expect(result.neglectedMeals).toEqual([neglected]);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("dedupes meals appearing in both mostCooked and neglected pools", () => {
    const dupe = stat({ mealId: "m-1", cookCount: 3, lastCookedAt: "2026-04-01" });
    const result = withSuggestions([], [dupe], [dupe]);
    const ids = result.suggestions.map((s) => s.mealId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
