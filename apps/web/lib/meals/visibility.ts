import { and, eq, isNotNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { meals, plans } from "@/db/schema";

/**
 * Meal visibility predicate — per-item sharing, layered on the legacy
 * household model.
 *
 * The viewer sees a meal if ANY of:
 *   (a) they created it (own it), OR
 *   (b) they hold an active per-item grant for it (the new model), OR
 *   (c) [legacy] it's marked shared AND lives in their household.
 *
 * Clause (b) is the going-forward path: sharing is now an explicit,
 * per-person grant (see db/schema/sharing.ts). Clause (c) is retained
 * during the UI transition so existing multi-member households keep the
 * access they already had — the 0030 migration also backfilled grants
 * for those, so (b) and (c) overlap there and (c) can be dropped once
 * the sharing UI fully lands. For solo users (everyone going forward)
 * clause (c) is inert (no co-members), so visibility reduces to
 * own-or-granted — private by default.
 *
 * Centralizing the filter here means every consumer ships the same
 * logic. Callers compose it via `where(and(existing, mealVisibilityFilter(...)))`.
 */
export function mealVisibilityFilter(
  userId: string,
  householdId: string
): SQL {
  return or(
    eq(meals.createdByUserId, userId),
    hasActiveGrant("recipe", meals.id, userId),
    and(isNotNull(meals.sharedAt), eq(meals.householdId, householdId))
  )!;
}

/**
 * `EXISTS (active item_grants row for this viewer)` as a correlated
 * subquery, usable inside any meal/plan WHERE clause. Raw SQL so it
 * composes with Drizzle predicates; the `item_grants_grantee_idx` +
 * `item_grants_item_idx` indexes back it. Drizzle renders the passed
 * column as its qualified name inside the template.
 */
export function hasActiveGrant(
  itemType: "recipe" | "plan",
  itemIdColumn: AnyColumn,
  userId: string
): SQL {
  return sql`exists (
    select 1 from item_grants g
    where g.item_type = ${itemType}
      and g.item_id = ${itemIdColumn}
      and g.grantee_user_id = ${userId}
      and g.revoked_at is null
  )`;
}

/**
 * Plan visibility predicate. Plans had no per-plan sharing in the old
 * model (every plan was household-wide), so the legacy clause matches the
 * whole household; the new clause adds per-person grants.
 */
export function planVisibilityFilter(userId: string, householdId: string): SQL {
  return or(
    eq(plans.createdByUserId, userId),
    hasActiveGrant("plan", plans.id, userId),
    eq(plans.householdId, householdId)
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
