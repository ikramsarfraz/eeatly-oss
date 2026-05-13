import { describe, expect, it } from "vitest";
import {
  computeRetentionStatus,
  parseSegmentFilter,
  type RetentionStatusInput
} from "./status";

const now = new Date("2026-05-13T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

function input(partial: Partial<RetentionStatusInput>): RetentionStatusInput {
  return {
    signupAt: daysAgo(0),
    mealCount: 0,
    lastMealLogAt: null,
    now,
    ...partial
  };
}

describe("computeRetentionStatus", () => {
  describe("inactive", () => {
    it("zero meals, signed up > 14 days ago", () => {
      expect(computeRetentionStatus(input({ signupAt: daysAgo(20) }))).toBe("inactive");
    });

    it("has meals but hasn't cooked in > 14 days", () => {
      expect(
        computeRetentionStatus(
          input({ signupAt: daysAgo(30), mealCount: 5, lastMealLogAt: daysAgo(20) })
        )
      ).toBe("inactive");
    });

    it("does NOT return inactive when zero meals but only 10 days since signup", () => {
      expect(computeRetentionStatus(input({ signupAt: daysAgo(10) }))).not.toBe("inactive");
    });
  });

  describe("new_user", () => {
    it("signed up within 7 days, no meals", () => {
      expect(computeRetentionStatus(input({ signupAt: daysAgo(3) }))).toBe("new_user");
    });

    it("signed up within 7 days, one meal", () => {
      expect(
        computeRetentionStatus(
          input({ signupAt: daysAgo(3), mealCount: 1, lastMealLogAt: daysAgo(1) })
        )
      ).toBe("new_user");
    });

    it("zero meals between 7 and 14 days since signup", () => {
      expect(computeRetentionStatus(input({ signupAt: daysAgo(10) }))).toBe("new_user");
    });
  });

  describe("activated", () => {
    it("one meal, cooked within last 7 days, signed up > 7 days ago", () => {
      expect(
        computeRetentionStatus(
          input({ signupAt: daysAgo(10), mealCount: 1, lastMealLogAt: daysAgo(3) })
        )
      ).toBe("activated");
    });
  });

  describe("engaged", () => {
    it("3+ meals within last 7 days", () => {
      expect(
        computeRetentionStatus(
          input({ signupAt: daysAgo(30), mealCount: 5, lastMealLogAt: daysAgo(2) })
        )
      ).toBe("engaged");
    });

    it("2+ meals within last 2 days", () => {
      expect(
        computeRetentionStatus(
          input({ signupAt: daysAgo(30), mealCount: 2, lastMealLogAt: daysAgo(1) })
        )
      ).toBe("engaged");
    });
  });

  describe("at_risk", () => {
    it("has meals but last cooked 7+ days ago and not inactive yet", () => {
      expect(
        computeRetentionStatus(
          input({ signupAt: daysAgo(30), mealCount: 3, lastMealLogAt: daysAgo(10) })
        )
      ).toBe("at_risk");
    });
  });

  it("falls back to at_risk when no other bucket matches", () => {
    // signupAt > 14 days, mealCount > 0, no lastMealLogAt — odd shape but
    // shouldn't crash.
    expect(
      computeRetentionStatus(
        input({ signupAt: daysAgo(30), mealCount: 1, lastMealLogAt: null })
      )
    ).toBe("at_risk");
  });
});

describe("parseSegmentFilter", () => {
  it.each([
    ["all", "all"],
    [undefined, "all"],
    ["", "all"],
    ["new", "new_user"],
    ["new_user", "new_user"],
    ["at-risk", "at_risk"],
    ["at_risk", "at_risk"],
    ["activated", "activated"],
    ["engaged", "engaged"],
    ["inactive", "inactive"]
  ] as const)("maps %s -> %s", (input, expected) => {
    expect(parseSegmentFilter(input as string | undefined)).toBe(expected);
  });

  it("returns all for unknown values", () => {
    expect(parseSegmentFilter("nonsense")).toBe("all");
    expect(parseSegmentFilter("DROP TABLE users")).toBe("all");
  });
});
