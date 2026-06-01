"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { LAUNCH_BADGE, TIERS } from "@/lib/pricing";

type AuthState =
  | { kind: "anonymous" }
  | { kind: "active_subscriber"; tier: "plus" | "pro" }
  | { kind: "signed_in_free" };

/** Live display prices for this tier, sourced from the Stripe catalog. */
type TierPriceDisplay = {
  monthly: { display: string } | null;
  annual: { display: string } | null;
};

type PricingCardProps = {
  /** Which paid tier this card represents. */
  tier: "plus" | "pro";
  /** Live prices from the Stripe catalog (null when that interval isn't sold). */
  prices: TierPriceDisplay;
  /** Launch promo (Plus-era) — only meaningful for the Plus card. */
  launchMode: boolean;
  authState: AuthState;
  features: string[];
};

export function PricingCard({
  tier,
  prices,
  launchMode,
  authState,
  features
}: PricingCardProps) {
  const { showToast } = useToast();
  const [priceType, setPriceType] = React.useState<"monthly" | "annual">("annual");
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation();
  const pending = checkoutMutation.isPending;

  const tierConfig = TIERS[tier];
  const tierName = tierConfig.name;
  // This tier is sellable when the catalog has at least one interval price.
  const billingConfigured = Boolean(prices.monthly || prices.annual);
  const livePrice = priceType === "monthly" ? prices.monthly : prices.annual;
  const suffix = priceType === "monthly" ? "/ month" : "/ year";
  const activePrice = {
    display: livePrice?.display ?? "—",
    suffix,
    note: priceType === "annual" ? "2 months free" : undefined
  };
  // Already subscribed AT or ABOVE this card's tier?
  const RANK = { plus: 1, pro: 2 } as const;
  const subscribedHere =
    authState.kind === "active_subscriber" && RANK[authState.tier] >= RANK[tier];

  async function handleUpgrade() {
    if (pending) return;
    try {
      const result = await checkoutMutation.mutateAsync({ tier, interval: priceType });
      window.location.href = result.url;
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't start checkout",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <section
      className={cn(
        "grid gap-5 rounded-2xl border-2 bg-background/70 p-6 shadow-sm sm:p-7",
        tier === "pro" ? "border-primary" : "border-primary/30"
      )}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <header className="grid gap-2">
        <div className="flex items-center gap-1.5 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="text-[12px] font-medium uppercase tracking-wide">
            eeatly {tierName}
          </span>
          {tier === "pro" ? (
            <span className="rounded-full bg-primary/10 px-2 py-px text-[10px] font-semibold text-primary">
              Most credits
            </span>
          ) : null}
        </div>
        <h2 className="font-serif text-[26px] font-normal leading-tight">
          {tierConfig.blurb}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tierConfig.monthlyCredits.toLocaleString()} AI credits / month · all
          features unlocked.
        </p>
      </header>

      <div
        className="inline-flex w-fit gap-1 rounded-full border bg-[var(--surface-2)] p-1"
        role="tablist"
        aria-label="Billing period"
      >
        <button
          type="button"
          role="tab"
          aria-selected={priceType === "annual"}
          onClick={() => setPriceType("annual")}
          className={cn(
            "rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors",
            priceType === "annual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Annual
          <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">
            best value
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={priceType === "monthly"}
          onClick={() => setPriceType("monthly")}
          className={cn(
            "rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors",
            priceType === "monthly"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Monthly
        </button>
      </div>

      <div className="grid gap-1">
        <div className="flex items-baseline gap-2">
          {launchMode && tier === "plus" ? (
            <>
              <span className="text-3xl font-semibold tracking-normal text-muted-foreground line-through decoration-2">
                {activePrice.display}
              </span>
              <span className="text-3xl font-semibold tracking-normal text-primary">
                $0
              </span>
              <span className="text-sm font-normal text-muted-foreground">today</span>
            </>
          ) : (
            <div className="text-3xl font-semibold tracking-normal">
              {activePrice.display}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {activePrice.suffix}
              </span>
            </div>
          )}
        </div>
        {priceType === "annual" && "note" in activePrice && activePrice.note ? (
          <p className="text-xs font-medium text-primary">{activePrice.note}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {launchMode && tier === "plus"
            ? LAUNCH_BADGE
            : `Billed ${priceType === "monthly" ? "monthly" : "yearly"} via Stripe. Cancel anytime.`}
        </p>
      </div>

      {/* CTA: launch promo (Plus only) → app, else auth/billing state. */}
      {launchMode && tier === "plus" ? (
        authState.kind === "anonymous" ? (
          <Button asChild className="w-full">
            <Link href={"/sign-up" as Route}>Start free during launch</Link>
          </Button>
        ) : subscribedHere ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={"/settings" as Route}>Manage billing</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href={"/dashboard" as Route}>You&apos;re all set — Plus is unlocked</Link>
          </Button>
        )
      ) : !billingConfigured ? (
        <Button type="button" disabled className="w-full">
          Coming soon
        </Button>
      ) : authState.kind === "anonymous" ? (
        <Button asChild className="w-full">
          <Link href={"/sign-in?next=/pricing" as Route}>Sign in to upgrade</Link>
        </Button>
      ) : subscribedHere ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={"/settings" as Route}>
            Your plan — manage billing
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleUpgrade}
          disabled={pending}
          className="w-full"
          variant={tier === "pro" ? "default" : "default"}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {authState.kind === "active_subscriber" ? `Switch to ${tierName}` : `Upgrade to ${tierName}`}
        </Button>
      )}

      <ul className="grid gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-foreground">{f}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
