import { describe, expect, it } from "vitest";
import { attributionLabel } from "./attribution";

const VIEWER = "u-viewer";

describe("attributionLabel", () => {
  it("returns null when the viewer cooked the meal", () => {
    expect(attributionLabel(VIEWER, "Alex", VIEWER)).toBeNull();
  });

  it("attributes by name when another current household member cooked", () => {
    expect(attributionLabel("u-other", "Maya", VIEWER)).toBe("by Maya");
  });

  it("renders 'by Former member' when the cook's user row has been deleted (id null + name null from SET NULL)", () => {
    // After migration 0017, deleting a user nulls cooked_by_user_id on
    // surviving logs. The LEFT JOIN through users yields a null name.
    // Without the explicit fallback the row would have no attribution and
    // look like the viewer cooked it — wrong, since the viewer is
    // someone else.
    expect(attributionLabel(null, null, VIEWER)).toBe("by Former member");
  });

  it("stays silent during the optimistic-update window (empty-string sentinels from useCreateMealLog)", () => {
    // The mutation hook seeds optimistic rows with "" for both fields
    // when the caller doesn't pass `cookedBy`. We deliberately don't
    // flash "Former member" while waiting for the server response.
    expect(attributionLabel("", "", VIEWER)).toBeNull();
  });

  it("attributes by name even when ids look unusual (defensive against id-format drift)", () => {
    expect(attributionLabel("abc-not-a-uuid", "Sam", VIEWER)).toBe("by Sam");
  });

  // Round 5 Task 0: meals.created_by_user_id now also drops to NULL when
  // the creator deletes their account (post-0018 migration matches the
  // post-0017 behavior on meal_logs.cooked_by_user_id). The helper is
  // field-agnostic; this test documents that a UI surface displaying
  // creator attribution would use the same helper with createdBy* fields
  // and get the same "Former member" fallback. No service currently
  // surfaces creator attribution, so this is intent-documentation; if a
  // future surface adds it (e.g., meal detail page "Added by X"), the
  // helper already handles the null case.
  it("renders 'by Former member' for a deleted recipe creator (same shape as deleted cook)", () => {
    // (createdByUserId, createdByName, viewer) — same call signature.
    const createdByUserId: string | null = null;
    const createdByName: string | null = null;
    expect(attributionLabel(createdByUserId, createdByName, VIEWER)).toBe("by Former member");
  });
});
