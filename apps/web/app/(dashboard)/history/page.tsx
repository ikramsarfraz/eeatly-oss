import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getDashboardMeals } from "@/services/meals";
import { listMealLibrary } from "@/services/plans";
import { LibraryClient, type LibraryStat } from "@/components/library/library-client";

export const metadata: Metadata = {
  title: "Library"
};

export const dynamic = "force-dynamic";

/**
 * Round 28 — Library.
 *
 * Repurposes the `/history` route to surface the new editorial
 * Library design. The previous History UI (per-log table with tabs +
 * filters) is retired in favor of a 4-up MealTile grid keyed off the
 * household's recipe catalog. The cook-log timeline still lives in
 * the data layer (`getHistoryRows`, `getHistoryStats`) — it's just
 * no longer the primary surface; a future per-meal "Cook history"
 * tab can re-expose it from the Recipe Detail page.
 *
 * Two queries run in parallel:
 *   - `listMealLibrary` returns the full household recipe list
 *     (`{ id, name, photoUrl }[]`) — the source of truth for the
 *     grid.
 *   - `getDashboardMeals` provides cook-stat overlays (cookCount,
 *     lastCookedAt, effort-of-most-recent-cook) for the meals the
 *     dashboard tracks. Stats are joined client-side; meals without
 *     stats render as "Not yet cooked".
 */
export default async function HistoryPage() {
  const { user, household } = await requireCurrentUserWithHousehold();

  const [rows, dashboard] = await Promise.all([
    listMealLibrary({ userId: user.id, householdId: household.id }),
    getDashboardMeals(user.id, household.id, { recentMealsLimit: 25 })
  ]);

  // Build the stat overlay from dashboard data. recentMeals carry
  // per-cook effort (modal effort isn't surfaced here); mostCooked
  // + neglected carry cook counts. Merge them keyed by mealId with
  // mostCooked / neglected as the source of truth for cook counts
  // and recentMeals as the source of truth for the most-recent
  // effort tag.
  const statsById = new Map<string, LibraryStat>();
  for (const stat of dashboard.mostCookedMeals) {
    statsById.set(stat.mealId, {
      mealId: stat.mealId,
      cookCount: stat.cookCount,
      lastCookedAt: stat.lastCookedAt,
      effortLevel: null
    });
  }
  for (const stat of dashboard.neglectedMeals) {
    if (statsById.has(stat.mealId)) continue;
    statsById.set(stat.mealId, {
      mealId: stat.mealId,
      cookCount: stat.cookCount,
      lastCookedAt: stat.lastCookedAt,
      effortLevel: null
    });
  }
  // Recents bring the most-recent effort tag; use that as a
  // best-effort effort indicator for the grid badge.
  for (const log of dashboard.recentMeals) {
    const existing = statsById.get(log.mealId);
    if (existing) {
      if (!existing.effortLevel) existing.effortLevel = log.effortLevel;
    } else {
      statsById.set(log.mealId, {
        mealId: log.mealId,
        cookCount: 1,
        lastCookedAt: log.cookedAt,
        effortLevel: log.effortLevel
      });
    }
  }

  return (
    <LibraryClient
      rows={rows.map((r) => ({
        id: r.id,
        name: r.name,
        photoUrl: r.photoUrl
      }))}
      stats={Array.from(statsById.values())}
    />
  );
}
