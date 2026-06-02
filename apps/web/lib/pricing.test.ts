import { describe, expect, it } from "vitest";
import { LAUNCH_BADGE, PRICING, resolveTier, TRIAL_DAYS } from "./pricing";

describe("resolveTier", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const dayMs = 86_400_000;

  it("maps an active subscription to its tier (sub wins over any trial)", () => {
    const justSignedUp = new Date(now.getTime() - dayMs); // still in trial window
    expect(
      resolveTier({
        subscriptionStatus: "active",
        subscriptionTier: "plus",
        createdAt: justSignedUp,
        now
      })
    ).toMatchObject({ tier: "plus", onTrial: false });
  });

  it("treats a null-tier active sub as plus (legacy)", () => {
    expect(
      resolveTier({ subscriptionStatus: "active", subscriptionTier: null, createdAt: null, now })
    ).toMatchObject({ tier: "plus", onTrial: false });
  });

  it("grants a Pro trial inside the first TRIAL_DAYS with no subscription", () => {
    const createdAt = new Date(now.getTime() - 3 * dayMs);
    const r = resolveTier({ subscriptionStatus: null, subscriptionTier: null, createdAt, now });
    expect(r.tier).toBe("pro");
    expect(r.onTrial).toBe(true);
    expect(r.trialDaysLeft).toBe(TRIAL_DAYS - 3);
    expect(r.trialEndsAt).toEqual(new Date(createdAt.getTime() + TRIAL_DAYS * dayMs));
  });

  it("drops to free once the trial window has passed", () => {
    const createdAt = new Date(now.getTime() - (TRIAL_DAYS + 1) * dayMs);
    expect(
      resolveTier({ subscriptionStatus: null, subscriptionTier: null, createdAt, now })
    ).toMatchObject({ tier: "free", onTrial: false, trialDaysLeft: 0 });
  });

  it("is free when there is neither a subscription nor a known signup date", () => {
    expect(
      resolveTier({ subscriptionStatus: null, subscriptionTier: null, createdAt: null, now })
    ).toMatchObject({ tier: "free", onTrial: false });
  });
});

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
