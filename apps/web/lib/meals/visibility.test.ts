import { describe, expect, it } from "vitest";
import { canViewMeal } from "./visibility";

/**
 * Round 32 — visibility predicate has six distinguishable cases. Each
 * one matters for either feature correctness or a data-leak guard,
 * so we cover them explicitly rather than parameterizing the matrix.
 */
describe("canViewMeal", () => {
  const VIEWER = { id: "user-A", householdId: "household-1" };
  const OTHER_USER = "user-B";
  const SAME_HH = "household-1";
  const OTHER_HH = "household-2";

  it("creator can always view their own shared meal", () => {
    expect(
      canViewMeal(
        {
          createdByUserId: VIEWER.id,
          householdId: SAME_HH,
          sharedAt: new Date()
        },
        VIEWER
      )
    ).toBe(true);
  });

  it("creator can always view their own personal meal", () => {
    expect(
      canViewMeal(
        { createdByUserId: VIEWER.id, householdId: SAME_HH, sharedAt: null },
        VIEWER
      )
    ).toBe(true);
  });

  it("household member can view someone else's shared meal in the same household", () => {
    expect(
      canViewMeal(
        {
          createdByUserId: OTHER_USER,
          householdId: SAME_HH,
          sharedAt: new Date()
        },
        VIEWER
      )
    ).toBe(true);
  });

  it("household member cannot view someone else's personal meal — data-leak guard", () => {
    expect(
      canViewMeal(
        {
          createdByUserId: OTHER_USER,
          householdId: SAME_HH,
          sharedAt: null
        },
        VIEWER
      )
    ).toBe(false);
  });

  it("non-member cannot view a shared meal in a different household", () => {
    expect(
      canViewMeal(
        {
          createdByUserId: OTHER_USER,
          householdId: OTHER_HH,
          sharedAt: new Date()
        },
        VIEWER
      )
    ).toBe(false);
  });

  it("non-member cannot view a personal meal in a different household", () => {
    expect(
      canViewMeal(
        {
          createdByUserId: OTHER_USER,
          householdId: OTHER_HH,
          sharedAt: null
        },
        VIEWER
      )
    ).toBe(false);
  });

  // Two edge cases worth pinning down — both are real shapes the
  // service layer can hand us.

  it("accepts an ISO-string sharedAt without coercion (mobile JSON wire format)", () => {
    expect(
      canViewMeal(
        {
          createdByUserId: OTHER_USER,
          householdId: SAME_HH,
          sharedAt: "2026-01-01T00:00:00.000Z"
        },
        VIEWER
      )
    ).toBe(true);
  });

  it("treats a meal with a null creator (deleted member) as personal-to-no-one", () => {
    // Defense-in-depth: if attribution was lost (R4.7 ON DELETE SET
    // NULL), other members still need to see the meal as long as it's
    // shared. The creator branch fails (null !== userId) so the shared
    // branch is the only path.
    expect(
      canViewMeal(
        {
          createdByUserId: null,
          householdId: SAME_HH,
          sharedAt: new Date()
        },
        VIEWER
      )
    ).toBe(true);
    expect(
      canViewMeal(
        {
          createdByUserId: null,
          householdId: SAME_HH,
          sharedAt: null
        },
        VIEWER
      )
    ).toBe(false);
  });
});
