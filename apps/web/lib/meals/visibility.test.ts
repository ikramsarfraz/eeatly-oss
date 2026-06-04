import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { mealVisibilityFilter, planVisibilityFilter } from "./visibility";

/**
 * Visibility is now PURE per-item sharing for recipes: a viewer sees a meal
 * only if they own it or hold an active grant. The legacy "shared recipe in
 * my household" clause was removed (it leaked the creator's new recipes to
 * household co-members). These tests render the predicate SQL and pin that
 * contract down — most importantly, that `shared_at` no longer appears in
 * the recipe predicate.
 */
const dialect = new PgDialect();
const render = (sql: ReturnType<typeof mealVisibilityFilter>) =>
  dialect.sqlToQuery(sql).sql;

describe("mealVisibilityFilter", () => {
  const sql = render(mealVisibilityFilter("user-A", "household-1"));

  it("matches the creator (owns the recipe)", () => {
    expect(sql).toContain("created_by_user_id");
  });

  it("matches an active per-item grant", () => {
    expect(sql).toContain("item_grants");
    expect(sql).toContain("revoked_at");
  });

  it("does NOT fall back to household-wide sharing — the leak fix", () => {
    expect(sql).not.toContain("shared_at");
    expect(sql).not.toContain("household_id");
  });
});

describe("planVisibilityFilter", () => {
  const sql = render(planVisibilityFilter("user-A", "household-1"));

  it("matches the creator and active grants", () => {
    expect(sql).toContain("created_by_user_id");
    expect(sql).toContain("item_grants");
  });

  it("does NOT fall back to household-wide plan visibility — the leak fix", () => {
    // Plans are now per-item too: a co-member sees a plan only if they own
    // it or hold a grant. The list query still scopes to the household, but
    // the predicate itself no longer grants household-wide access.
    expect(sql).not.toContain("household_id");
  });
});
