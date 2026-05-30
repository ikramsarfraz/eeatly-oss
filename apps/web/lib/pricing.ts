/**
 * Release-v1 pricing display — single source of truth for the numbers
 * shown on the marketing + settings surfaces.
 *
 * These are DISPLAY strings only. The Stripe price *IDs* used at checkout
 * come from `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` env vars (read
 * in `services/billing.ts`) once billing is live. Keeping display here
 * means the pricing page renders real numbers even before Stripe is
 * configured. IMPORTANT: when you create the Stripe Prices, their amounts
 * must match the `amount` values below ($5 / mo, $50 / yr) — nothing
 * reconciles them automatically, so a mismatch would show one price and
 * charge another.
 *
 * Annual = 10 × monthly = 2 months free. The relationship is asserted in
 * `pricing.test.ts` so a future price tweak can't silently break the
 * "2 months free" promise.
 */
export const PRICING = {
  monthly: {
    amount: 5,
    display: "$5",
    suffix: "/ month"
  },
  annual: {
    amount: 50,
    display: "$50",
    suffix: "/ year",
    monthsFree: 2,
    note: "2 months free"
  }
} as const;

/** Launch-promo badge copy, shown when `isLaunchFreeAccess` is on. */
export const LAUNCH_BADGE = "Free during launch · no card needed";
