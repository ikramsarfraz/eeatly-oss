/**
 * Pricing + AI-credits config — single source of truth for the numbers
 * shown on the marketing/settings surfaces AND the metering math.
 *
 * DISPLAY amounts here must match the amounts on the Stripe Prices you
 * create; nothing reconciles them automatically. Stripe price *IDs* come
 * from env (`STRIPE_PRICE_*`, read in `services/billing.ts`); the env →
 * tier/pack mapping also lives in the billing service.
 *
 * Two paid tiers (Plus, Pro) differ ONLY by their included monthly AI
 * credit grant + burst limits — every feature is unlocked on both. Free
 * users get a small monthly grant so they can taste AI. Everyone can buy
 * one-time top-up packs that roll over.
 */

export type Tier = "free" | "plus" | "pro";
export type BillingInterval = "monthly" | "annual";

/** Subscription tiers — display + the monthly AI credit grant each includes. */
export const TIERS = {
  free: {
    name: "Free",
    monthly: { amount: 0, display: "$0" },
    annual: { amount: 0, display: "$0" },
    monthlyCredits: 15,
    blurb: "Your cooking memory, plus a taste of AI."
  },
  plus: {
    name: "Plus",
    monthly: { amount: 5, display: "$5", suffix: "/ month" },
    annual: { amount: 50, display: "$50", suffix: "/ year", monthsFree: 2, note: "2 months free" },
    monthlyCredits: 300,
    blurb: "Everything unlocked + 300 AI credits a month."
  },
  pro: {
    name: "Pro",
    monthly: { amount: 12, display: "$12", suffix: "/ month" },
    annual: { amount: 120, display: "$120", suffix: "/ year", monthsFree: 2, note: "2 months free" },
    monthlyCredits: 1500,
    blurb: "For heavy cooks — 1,500 AI credits a month + priority.",
    highlight: true
  }
} as const satisfies Record<
  Tier,
  {
    name: string;
    monthly: { amount: number; display: string; suffix?: string };
    annual: {
      amount: number;
      display: string;
      suffix?: string;
      monthsFree?: number;
      note?: string;
    };
    monthlyCredits: number;
    blurb: string;
    highlight?: boolean;
  }
>;

/** The two paid tiers, in display order. */
export const PAID_TIERS = ["plus", "pro"] as const;

/** Monthly included credit grant per tier. */
export const MONTHLY_CREDIT_GRANT: Record<Tier, number> = {
  free: TIERS.free.monthlyCredits,
  plus: TIERS.plus.monthlyCredits,
  pro: TIERS.pro.monthlyCredits
};

/**
 * Back-compat alias — the old single-tier `PRICING.monthly/annual` shape
 * pointed at Plus. Kept so any remaining importers (and pricing.test) keep
 * resolving real numbers; new code should read `TIERS`.
 */
export const PRICING = {
  monthly: { amount: TIERS.plus.monthly.amount, display: TIERS.plus.monthly.display, suffix: "/ month" },
  annual: {
    amount: TIERS.plus.annual.amount,
    display: TIERS.plus.annual.display,
    suffix: "/ year",
    monthsFree: 2,
    note: "2 months free"
  }
} as const;

/**
 * AI operations and their credit cost. Cheap text/LLM ops cost 1; ops that
 * lean on heavier models (vision, Whisper) cost 2; image *generation*
 * (gpt-image-1) is the expensive one at 10. Keys are the `AiOperation`
 * union the metering wrapper passes.
 */
export const AI_CREDIT_COSTS = {
  suggest_text: 1,
  suggest_voice: 2,
  suggest_image: 2,
  refine_text: 1,
  refine_voice: 2,
  refine_photo: 2,
  extract_ingredients: 1,
  share_recipe: 1,
  dish_image: 10
} as const;

export type AiOperation = keyof typeof AI_CREDIT_COSTS;

export function creditCost(op: AiOperation): number {
  return AI_CREDIT_COSTS[op];
}

// Credit top-up packs are NOT configured here — they're synced from Stripe
// (one-time Prices tagged `metadata.kind=credits` + `metadata.credits`), read
// via `services/stripe-catalog.ts`. Add/retire a pack in Stripe, no code change.

/** Launch-promo badge copy, shown when `isLaunchFreeAccess` is on. */
export const LAUNCH_BADGE = "Free during launch · no card needed";
