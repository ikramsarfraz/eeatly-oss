import "server-only";

import { getStripeCatalog, perMonthDisplay } from "@/services/stripe-catalog";
import { MONTHLY_CREDIT_GRANT, TIERS, type TierDisplay, type TierDisplayMap } from "@/lib/pricing";

/**
 * Single source of truth for the prices shown on every pricing surface
 * (landing table, /pricing cards, settings). Prices come straight from the
 * live Stripe catalog; when a tier has no Stripe price yet (Stripe not wired /
 * launch mode), it falls back to the hardcoded `TIERS` display amounts so the
 * surfaces never show a blank. Credits are always from `lib/pricing` (Stripe
 * has no concept of them).
 */
export async function getTierDisplayPrices(): Promise<TierDisplayMap> {
  const catalog = await getStripeCatalog();

  const resolve = (tier: "plus" | "premium" | "pro"): TierDisplay => {
    const t = TIERS[tier];
    const cp = catalog.tiers[tier];
    return {
      monthly: cp.monthly?.display ?? t.monthly.display,
      annualPerMonth: cp.annual ? perMonthDisplay(cp.annual) : t.annual.perMonthDisplay,
      annualTotal: cp.annual?.display ?? t.annual.display,
      credits: MONTHLY_CREDIT_GRANT[tier]
    };
  };

  return {
    free: { monthly: "$0", annualPerMonth: "$0", annualTotal: "$0", credits: MONTHLY_CREDIT_GRANT.free },
    plus: resolve("plus"),
    premium: resolve("premium"),
    pro: resolve("pro")
  };
}
