import "server-only";

import { getServerEnv, hasStripeEnv } from "@/lib/env/server";
import { getStripeClient } from "@/lib/stripe/client";
import { logger } from "@/lib/observability/logger";
import type { BillingInterval } from "@/lib/pricing";

/**
 * Stripe is the source of truth for the sellable catalog — which tiers and
 * credit packs exist and what they cost. We DON'T keep price ids in env;
 * instead each Stripe Price is tagged with metadata and we fetch the active
 * catalog at runtime (cached). Quota config (monthly credit grants per tier,
 * per-op costs) stays in `lib/pricing.ts` — Stripe has no concept of those.
 *
 * Price metadata contract (set on each Stripe Price):
 *   - tier prices (recurring): metadata.plan = "plus" | "pro",
 *     metadata.interval = "month" | "year"
 *   - credit packs (one-time):  metadata.kind = "credits",
 *     metadata.credits = "<integer>"
 */

export type CatalogPrice = {
  priceId: string;
  unitAmount: number; // cents
  amount: number; // major units (e.g. dollars)
  currency: string;
  display: string; // e.g. "$12"
};

export type TierPrices = {
  monthly: CatalogPrice | null;
  annual: CatalogPrice | null;
};

export type CreditPack = CatalogPrice & { credits: number };

export type StripeCatalog = {
  tiers: { plus: TierPrices; pro: TierPrices };
  packs: CreditPack[];
  /** priceId → its identity, for webhook tier resolution + validation. */
  byPriceId: Record<
    string,
    | { kind: "tier"; plan: "plus" | "pro"; interval: BillingInterval }
    | { kind: "credits"; credits: number }
  >;
};

const EMPTY: StripeCatalog = {
  tiers: { plus: { monthly: null, annual: null }, pro: { monthly: null, annual: null } },
  packs: [],
  byPriceId: {}
};

const TTL_MS = 5 * 60 * 1000;
let cache: { data: StripeCatalog; expires: number } | null = null;

/** Reset the in-memory catalog cache (used after price edits / in tests). */
export function __resetCatalogCache(): void {
  cache = null;
}

function formatAmount(unitAmount: number, currency: string): string {
  const major = unitAmount / 100;
  const whole = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return currency.toLowerCase() === "usd" ? `$${whole}` : `${whole} ${currency.toUpperCase()}`;
}

function toCatalogPrice(priceId: string, unitAmount: number, currency: string): CatalogPrice {
  return {
    priceId,
    unitAmount,
    amount: unitAmount / 100,
    currency,
    display: formatAmount(unitAmount, currency)
  };
}

/**
 * Fetch (and cache) the active catalog from Stripe. Returns an empty catalog
 * when Stripe isn't configured, or on error — callers degrade to "coming
 * soon" / no checkout rather than crashing.
 */
export async function getStripeCatalog(opts?: { force?: boolean }): Promise<StripeCatalog> {
  if (!hasStripeEnv(getServerEnv())) return EMPTY;
  if (!opts?.force && cache && cache.expires > Date.now()) return cache.data;

  try {
    const stripe = getStripeClient();
    const prices = await stripe.prices.list({ active: true, limit: 100 });

    const catalog: StripeCatalog = {
      tiers: { plus: { monthly: null, annual: null }, pro: { monthly: null, annual: null } },
      packs: [],
      byPriceId: {}
    };

    for (const price of prices.data) {
      if (price.unit_amount == null) continue;
      const meta = price.metadata ?? {};
      const cp = toCatalogPrice(price.id, price.unit_amount, price.currency);

      if (price.type === "recurring" && (meta.plan === "plus" || meta.plan === "pro")) {
        const interval: BillingInterval =
          meta.interval === "year" || price.recurring?.interval === "year" ? "annual" : "monthly";
        catalog.tiers[meta.plan][interval] = cp;
        catalog.byPriceId[price.id] = { kind: "tier", plan: meta.plan, interval };
      } else if (price.type === "one_time" && meta.kind === "credits") {
        const credits = Number.parseInt(meta.credits ?? "", 10);
        if (Number.isFinite(credits) && credits > 0) {
          catalog.packs.push({ ...cp, credits });
          catalog.byPriceId[price.id] = { kind: "credits", credits };
        }
      }
    }

    // Stable, cheapest-first pack ordering for the UI.
    catalog.packs.sort((a, b) => a.unitAmount - b.unitAmount);

    cache = { data: catalog, expires: Date.now() + TTL_MS };
    return catalog;
  } catch (error) {
    logger.warn("stripe_catalog_fetch_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return cache?.data ?? EMPTY;
  }
}

/** Resolve the Stripe price id for a (tier, interval) from the live catalog. */
export async function priceIdForTier(
  tier: "plus" | "pro",
  interval: BillingInterval
): Promise<string | null> {
  const catalog = await getStripeCatalog();
  return catalog.tiers[tier][interval]?.priceId ?? null;
}

/** Look up a credit pack (credits + amount) by its Stripe price id. */
export async function creditPackForPriceId(priceId: string): Promise<CreditPack | null> {
  const catalog = await getStripeCatalog();
  return catalog.packs.find((p) => p.priceId === priceId) ?? null;
}
