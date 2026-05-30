import { describe, expect, it } from "vitest";
import { LAUNCH_BADGE, PRICING } from "./pricing";

describe("PRICING", () => {
  it("annual is 10× monthly — i.e. two months free", () => {
    expect(PRICING.annual.amount).toBe(PRICING.monthly.amount * 10);
    // The "2 months free" promise: annual costs 10 months at the monthly
    // rate, so 12 − 10 = 2 months are free.
    const monthsCharged = PRICING.annual.amount / PRICING.monthly.amount;
    expect(12 - monthsCharged).toBe(PRICING.annual.monthsFree);
    expect(PRICING.annual.monthsFree).toBe(2);
  });

  it("display strings match the numeric amounts", () => {
    expect(PRICING.monthly.display).toBe(`$${PRICING.monthly.amount}`);
    expect(PRICING.annual.display).toBe(`$${PRICING.annual.amount}`);
  });

  it("exposes launch badge copy", () => {
    expect(LAUNCH_BADGE.length).toBeGreaterThan(0);
  });
});
