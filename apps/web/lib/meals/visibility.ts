import { eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { meals, plans } from "@/db/schema";

/**
 * Meal visibility predicate — pure per-item sharing.
 *
 * The viewer sees a meal if EITHER:
 *   (a) they created it (own it), OR
 *   (b) they hold an active per-item grant for it.
 *
 * The legacy "shared AND same household" clause was REMOVED: under the old
 * one-shared-kitchen model every member saw every shared meal, which leaked
 * the creator's new recipes to household co-members. The 0030 migration
 * backfilled grants for every recipe that was shared at that point, so
 * dropping the legacy clause preserves pre-migration access (via clause b)
 * while making recipes the creator never explicitly shared private again.
 * Recipes are now private by default (`createMealLog` inserts `sharedAt =
 * null`); `sharedAt` no longer drives visibility at all.
 *
 * Centralizing the filter here means every consumer ships the same
 * logic. Callers compose it via `where(and(existing, mealVisibilityFilter(...)))`.
 *
 * `householdId` is retained in the signature (callers still pass it) but is
 * no longer referenced — visibility is household-independent now.
 */
export function mealVisibilityFilter(
  userId: string,
  householdId: string
): SQL {
  // `householdId` is retained for call-site symmetry (and parity with
  // planVisibilityFilter) but no longer referenced — recipe visibility is
  // household-independent now (own-or-granted).
  void householdId;
  return or(
    eq(meals.createdByUserId, userId),
    hasActiveGrant("recipe", meals.id, userId)
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
 * Plan visibility predicate. Plan-level visibility intentionally stays
 * household-wide: co-cooks see each other's plans, but the recipes behind
 * each dish are locked unless the viewer owns or was granted them (see
 * `getPlanDetail`'s per-dish `accessible` check). The new clause adds
 * per-person grants on top for cross-household plan shares.
 */
export function planVisibilityFilter(userId: string, householdId: string): SQL {
  return or(
    eq(plans.createdByUserId, userId),
    hasActiveGrant("plan", plans.id, userId),
    eq(plans.householdId, householdId)
  )!;
}
