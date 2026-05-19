import { and, eq, isNotNull, or, type SQL } from "drizzle-orm";
import { meals } from "@/db/schema";

/**
 * Round 32 — shared-by-default meal visibility predicate.
 *
 * The canonical filter every meal-reading procedure applies:
 *
 *   meal.creator_user_id = :userId
 *     OR (meal.shared_at IS NOT NULL AND meal.household_id = :householdId)
 *
 * In English: the viewer sees a meal if either (a) they created it
 * — personal meals are always visible to their creator — or (b) the
 * meal is marked shared AND it lives in the viewer's household. The
 * predicate intentionally never returns rows from another household
 * even when the meal is shared; cross-household visibility is a
 * separate (deferred) concern.
 *
 * Centralizing the filter here means every consumer ships the same
 * logic. A bug in one query never fragments into many. New consumers
 * just append `.where(mealVisibilityFilter(userId, householdId))` and
 * inherit the behavior.
 *
 * NB: the SQL helper returns a `SQL` predicate, not a query — callers
 * combine it with their existing `WHERE` clauses via `and(...)`. The
 * pattern is `where(and(existing, mealVisibilityFilter(...)))` rather
 * than mutating the query in place, so the helper composes with any
 * builder chain (`.where()`, `.from(...).where(...)`,
 * `query.findFirst({ where: ... })`).
 */
export function mealVisibilityFilter(
  userId: string,
  householdId: string
): SQL {
  return or(
    eq(meals.createdByUserId, userId),
    and(isNotNull(meals.sharedAt), eq(meals.householdId, householdId))
  )!;
}

/**
 * Pure-function variant for client-side filtering of an already-loaded
 * meal list (e.g. the Library tab filtering after the query lands, or
 * any view that needs to compute a count by visibility class without
 * a round-trip). Same predicate as the SQL helper above.
 *
 * Argument shape kept minimal so any consumer with the four fields can
 * call it without reshaping. Date typing matches Drizzle's projected
 * shape; ISO-string callers (mobile JSON wire format) cast to Date or
 * use `parseISO` upstream.
 */
export function canViewMeal(
  meal: {
    createdByUserId: string | null;
    householdId: string;
    sharedAt: Date | string | null;
  },
  viewer: { id: string; householdId: string }
): boolean {
  if (meal.createdByUserId === viewer.id) return true;
  if (meal.sharedAt !== null && meal.householdId === viewer.householdId) {
    return true;
  }
  return false;
}
