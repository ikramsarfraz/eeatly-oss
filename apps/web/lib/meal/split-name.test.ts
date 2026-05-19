import { describe, expect, it } from "vitest";
import { splitMealName } from "./split-name";

describe("splitMealName", () => {
  it("returns headline-only for single-word names with a trailing period", () => {
    expect(splitMealName("Biryani")).toEqual({ headline: "Biryani." });
  });

  it("splits two-word names into italic kicker + headline", () => {
    expect(splitMealName("Chowmein Noodles")).toEqual({
      kicker: "Chowmein,",
      headline: "Noodles."
    });
  });

  it("preserves multi-word kickers verbatim", () => {
    expect(splitMealName("Chicken Tikka Masala")).toEqual({
      kicker: "Chicken Tikka,",
      headline: "Masala."
    });
  });

  it("treats whitespace-only input as empty (no headline content)", () => {
    expect(splitMealName("   ")).toEqual({ headline: "." });
  });

  it("treats the empty string as empty", () => {
    expect(splitMealName("")).toEqual({ headline: "." });
  });

  it("collapses runs of internal whitespace when splitting", () => {
    // "Spaghetti   alle vongole" — tabs / multiple spaces all collapse
    // through the /\s+/ split so the kicker reads cleanly.
    expect(splitMealName("Spaghetti\t  alle  vongole")).toEqual({
      kicker: "Spaghetti alle,",
      headline: "vongole."
    });
  });

  it("ignores leading + trailing whitespace before splitting", () => {
    expect(splitMealName("  Beef Pho  ")).toEqual({
      kicker: "Beef,",
      headline: "Pho."
    });
  });

  it("keeps internal commas in the kicker (no special handling)", () => {
    // The trailing comma we append doubles the punctuation here; that's
    // the documented behavior — internal punctuation isn't stripped.
    expect(splitMealName("Pasta, alla vodka")).toEqual({
      kicker: "Pasta, alla,",
      headline: "vodka."
    });
  });

  it("retains case and punctuation inside individual words", () => {
    expect(splitMealName("Eid Biryani 2026")).toEqual({
      kicker: "Eid Biryani,",
      headline: "2026."
    });
  });
});
