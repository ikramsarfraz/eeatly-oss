import { describe, expect, it } from "vitest";
import {
  COOK_FREQUENCY_BUCKETS,
  onboardingHabitsInputSchema
} from "@eeatly/api/validators/onboarding";

describe("onboardingHabitsInputSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = onboardingHabitsInputSchema.parse({
      cooksPerWeek: 3,
      weeknightEffort: "easy"
    });
    expect(parsed.cooksPerWeek).toBe(3);
    expect(parsed.weeknightEffort).toBe("easy");
  });

  it.each([-1, -10, 1.5, 15, Number.NaN])(
    "rejects out-of-range cooksPerWeek (%s)",
    (value) => {
      expect(() =>
        onboardingHabitsInputSchema.parse({
          cooksPerWeek: value,
          weeknightEffort: "easy"
        })
      ).toThrow();
    }
  );

  it("rejects unknown weeknightEffort values", () => {
    expect(() =>
      onboardingHabitsInputSchema.parse({
        cooksPerWeek: 3,
        weeknightEffort: "instant"
      })
    ).toThrow();
  });

  it("accepts the boundary values (0 and 14)", () => {
    expect(() =>
      onboardingHabitsInputSchema.parse({ cooksPerWeek: 0, weeknightEffort: "quick" })
    ).not.toThrow();
    expect(() =>
      onboardingHabitsInputSchema.parse({ cooksPerWeek: 14, weeknightEffort: "high_effort" })
    ).not.toThrow();
  });
});

describe("COOK_FREQUENCY_BUCKETS", () => {
  it("has unique values", () => {
    const values = COOK_FREQUENCY_BUCKETS.map((b) => b.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("only contains values the schema accepts", () => {
    for (const bucket of COOK_FREQUENCY_BUCKETS) {
      expect(() =>
        onboardingHabitsInputSchema.parse({
          cooksPerWeek: bucket.value,
          weeknightEffort: "easy"
        })
      ).not.toThrow();
    }
  });

  it("is sorted in ascending order", () => {
    const values = COOK_FREQUENCY_BUCKETS.map((b) => b.value);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });
});
