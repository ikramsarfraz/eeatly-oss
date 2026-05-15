import { describe, expect, it } from "vitest";
import { bumpYearInName } from "./clone-name";

describe("bumpYearInName", () => {
  it("bumps a single trailing year", () => {
    expect(bumpYearInName("Eid al-Adha 2024")).toBe("Eid al-Adha 2025");
  });

  it("bumps a year embedded mid-name", () => {
    expect(bumpYearInName("Maya's 2024 birthday menu")).toBe(
      "Maya's 2025 birthday menu"
    );
  });

  it("anchors on the last year if multiple appear", () => {
    expect(bumpYearInName("1971 Mom's Eid 2024")).toBe("1971 Mom's Eid 2025");
  });

  it("falls back to '(copy)' when no year is detected", () => {
    expect(bumpYearInName("Tuesday roast")).toBe("Tuesday roast (copy)");
  });

  it("doesn't treat 4-digit non-year numbers as years (e.g., '300')", () => {
    expect(bumpYearInName("300 prep notes")).toBe("300 prep notes (copy)");
  });

  it("handles the boundary year 2099 (still recognized)", () => {
    expect(bumpYearInName("Future Eid 2099")).toBe("Future Eid 2100");
    // Note: 2100 falls outside the regex range, so a re-clone would
    // append "(copy)" — acceptable; deferred decade boundary.
  });

  it("preserves whitespace and surrounding punctuation", () => {
    expect(bumpYearInName("  Eid 2024  ")).toBe("  Eid 2025  ");
    expect(bumpYearInName("Eid 2024!")).toBe("Eid 2025!");
  });
});
