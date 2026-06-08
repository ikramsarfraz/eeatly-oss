"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { BillingInterval } from "@/lib/pricing";
import { PricingCard, type TierPriceDisplay } from "./pricing-card";

type AuthState =
  | { kind: "anonymous" }
  | { kind: "active_subscriber"; tier: "plus" | "premium" | "pro" }
  | { kind: "signed_in_free" };

type PricingGridProps = {
  authState: AuthState;
  launchMode: boolean;
  plusPrices: TierPriceDisplay;
  premiumPrices: TierPriceDisplay;
  proPrices: TierPriceDisplay;
};

/**
 * Client wrapper that owns the single, page-level billing-interval toggle
 * and feeds it to all three cards so they never disagree. The server
 * component fetches the catalog prices + auth state and passes them in.
 */
export function PricingGrid({
  authState,
  launchMode,
  plusPrices,
  premiumPrices,
  proPrices
}: PricingGridProps) {
  const [interval, setInterval] = React.useState<BillingInterval>("annual");

  return (
    <>
      {/* Billing toggle — single source of truth for both paid cards. */}
      <div className="mb-7 mt-2 flex justify-center">
        <div
          role="tablist"
          aria-label="Billing period"
          className="inline-flex gap-1 rounded-full border bg-[var(--surface-2)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={interval === "annual"}
            onClick={() => setInterval("annual")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors",
              interval === "annual"
                ? "bg-[var(--surface)] text-foreground shadow-[var(--shadow-sm)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.5px] text-primary">
              Save
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={interval === "monthly"}
            onClick={() => setInterval("monthly")}
            className={cn(
              "rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors",
              interval === "monthly"
                ? "bg-[var(--surface)] text-foreground shadow-[var(--shadow-sm)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Four-tier grid — Cook → Chef → Head Chef → Master Chef. */}
      <div className="mx-auto grid max-w-[460px] grid-cols-1 items-stretch gap-5 lg:max-w-none lg:grid-cols-4">
        <PricingCard
          tier="free"
          prices={null}
          launchMode={false}
          authState={authState}
          interval={interval}
        />
        <PricingCard
          tier="plus"
          prices={plusPrices}
          launchMode={launchMode}
          authState={authState}
          interval={interval}
        />
        <PricingCard
          tier="premium"
          prices={premiumPrices}
          launchMode={false}
          authState={authState}
          interval={interval}
        />
        <PricingCard
          tier="pro"
          prices={proPrices}
          launchMode={false}
          authState={authState}
          interval={interval}
        />
      </div>
    </>
  );
}
