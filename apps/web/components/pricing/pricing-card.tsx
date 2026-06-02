"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Check, ChefHat, Crown, Loader2, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { TIER_FEATURES, TIERS, type BillingInterval, type Tier } from "@/lib/pricing";

type AuthState =
  | { kind: "anonymous" }
  | { kind: "active_subscriber"; tier: "plus" | "pro" }
  | { kind: "signed_in_free" };

/** Live display prices for this tier, sourced from the Stripe catalog. */
export type TierPriceDisplay = {
  monthly: { display: string } | null;
  annual: { display: string; perMonthDisplay: string } | null;
};

type PricingCardProps = {
  /** Which tier this card represents. */
  tier: Tier;
  /** Live prices from the Stripe catalog (null for the free tier / unsold). */
  prices: TierPriceDisplay | null;
  /** Launch promo (Chef-era) — only meaningful for the Chef card. */
  launchMode: boolean;
  authState: AuthState;
  /** Billing period — lifted to the page-level grid so all cards agree. */
  interval: BillingInterval;
};

const TIER_ICON: Record<Tier, LucideIcon> = { free: ChefHat, plus: Users, pro: Crown };
const FEAT_LABEL: Record<Tier, string> = {
  free: "What's included",
  plus: "Everything in Cook, and",
  pro: "Everything in Chef, and"
};
const RANK = { free: 0, plus: 1, pro: 2 } as const;

export function PricingCard({ tier, prices, launchMode, authState, interval }: PricingCardProps) {
  const { showToast } = useToast();
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation();
  const pending = checkoutMutation.isPending;

  const tierConfig = TIERS[tier];
  const tierName = tierConfig.name;
  const features = TIER_FEATURES[tier];
  const Icon = TIER_ICON[tier];
  const isFree = tier === "free";
  const isFeatured = tier === "pro";

  // This tier is sellable when the catalog has at least one interval price.
  const billingConfigured = isFree || Boolean(prices?.monthly || prices?.annual);

  // Headline: free is always $0; paid tiers show the per-month figure for
  // the selected interval (annual shows the lower effective monthly).
  const headline = isFree
    ? "$0"
    : interval === "monthly"
      ? (prices?.monthly?.display ?? "—")
      : (prices?.annual?.perMonthDisplay ?? "—");

  // Already subscribed AT or ABOVE this card's tier?
  const subscribedHere =
    authState.kind === "active_subscriber" && RANK[authState.tier] >= RANK[tier];

  async function handleUpgrade() {
    if (pending || isFree) return;
    try {
      const result = await checkoutMutation.mutateAsync({
        tier: tier as "plus" | "pro",
        interval
      });
      window.location.assign(result.url);
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
        "group flex flex-col rounded-[22px] border bg-[var(--surface)] p-7 shadow-[var(--shadow-sm)]",
        "transition-[transform,box-shadow,border-color] duration-200",
        "hover:shadow-[var(--shadow-md)] lg:hover:-translate-y-[3px] motion-reduce:transform-none",
        isFeatured
          ? "border-primary shadow-[var(--shadow-md)] ring-1 ring-primary/40 dark:bg-[color-mix(in_srgb,var(--surface)_88%,var(--primary))]"
          : "border-[color:var(--border)]"
      )}
    >
      {/* Head row */}
      <div className="mb-4 flex min-h-[22px] items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold uppercase tracking-[1.4px]",
            isFeatured ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[var(--primary-soft)] text-primary">
            <Icon className="h-3 w-3" strokeWidth={2.2} aria-hidden />
          </span>
          {tierName}
        </span>
        {isFree ? (
          <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">
            Free forever
          </span>
        ) : isFeatured ? (
          <span className="rounded-full bg-primary px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[1px] text-primary-foreground">
            Most powerful
          </span>
        ) : null}
      </div>

      {/* Price block */}
      <div className="mb-1.5">
        <span className="inline-flex items-baseline font-serif text-[54px] leading-none tracking-[-0.02em] text-foreground">
          {headline}
          <span className="ml-2 text-[14px] font-medium text-muted-foreground">/ month</span>
        </span>
        <p className="mt-2 min-h-[18px] text-[12.5px] text-muted-foreground">
          {isFree ? (
            "No card, no expiry."
          ) : interval === "annual" && prices?.annual ? (
            <>
              Billed {prices.annual.display} yearly
              <span className="font-semibold text-primary"> · 2 months free</span>
            </>
          ) : (
            "Billed monthly"
          )}
        </p>
        <p className="mt-[3px] text-[12px] text-muted-foreground">
          {isFree ? "Your library stays yours." : "Cancel anytime from Settings."}
        </p>
      </div>

      {/* Credits pill */}
      <div
        className={cn(
          "mb-1 mt-[18px] flex items-baseline gap-2 rounded-[13px] border px-3.5 py-3",
          isFeatured
            ? "border-primary/25 bg-[var(--primary-soft)]"
            : "border-[var(--border-soft,var(--border))] bg-[var(--surface-2)]"
        )}
      >
        <span
          className={cn(
            "font-serif text-[26px] leading-none tracking-[-0.01em]",
            isFeatured ? "text-primary" : "text-foreground"
          )}
        >
          {tierConfig.monthlyCredits.toLocaleString()}
        </span>
        <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
          AI credits / month
        </span>
      </div>

      {/* Blurb */}
      <p className="mb-[22px] mt-3.5 min-h-10 text-pretty text-[13.5px] leading-snug text-muted-foreground">
        {tierConfig.blurb}
      </p>

      {/* CTA */}
      <CardCta
        tier={tier}
        tierName={tierName}
        isFree={isFree}
        isFeatured={isFeatured}
        launchMode={launchMode}
        billingConfigured={billingConfigured}
        authState={authState}
        subscribedHere={subscribedHere}
        pending={pending}
        onUpgrade={handleUpgrade}
      />

      {/* Feature list — flows directly after the CTA (no bottom-align). */}
      <div className="mt-6 border-t border-[var(--border-soft,var(--border))] pt-[22px]">
        <p className="mb-3.5 font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-muted-foreground">
          {FEAT_LABEL[tier]}
        </p>
        <ul className="grid gap-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-pretty text-[13.5px] leading-snug">
              <span className="mt-px inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-primary">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />
              </span>
              <span className="text-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

type CardCtaProps = {
  tier: Tier;
  tierName: string;
  isFree: boolean;
  isFeatured: boolean;
  launchMode: boolean;
  billingConfigured: boolean;
  authState: AuthState;
  subscribedHere: boolean;
  pending: boolean;
  onUpgrade: () => void;
};

/**
 * The CTA. Two visual variants only, keyed off the tier (not the state):
 * Master Chef is the single filled-primary button on the page; Cook + Chef
 * are ghost. The ghost class forces `bg-transparent` because shadcn's
 * `outline` ships `bg-background`, which reads as a solid fill on the
 * translucent card. Free links out; paid tiers keep the full
 * auth / billing / launch-promo branching.
 */
function CardCta({
  tier,
  tierName,
  isFree,
  isFeatured,
  launchMode,
  billingConfigured,
  authState,
  subscribedHere,
  pending,
  onUpgrade
}: CardCtaProps) {
  // Let padding define the height (no fixed `h-10` from the default size).
  const base = "h-auto w-full rounded-[13px] px-[18px] py-[13px] text-[14.5px] font-semibold";
  const variant = isFeatured ? "default" : "ghost";
  const className = cn(
    base,
    isFeatured
      ? "shadow-[0_8px_22px_-10px_color-mix(in_srgb,var(--primary)_60%,transparent)] hover:bg-primary/90"
      : "border border-border bg-transparent text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
  );

  // Cook — non-purchasing. Anonymous → sign up; signed in → straight to app.
  if (isFree) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={(authState.kind === "anonymous" ? "/sign-up" : "/dashboard") as Route}>
          Start free
        </Link>
      </Button>
    );
  }

  // Launch promo (Chef only) → straight into the app, no checkout.
  if (launchMode && tier === "plus") {
    if (authState.kind === "anonymous") {
      return (
        <Button asChild variant={variant} className={className}>
          <Link href={"/sign-up" as Route}>Start free during launch</Link>
        </Button>
      );
    }
    if (subscribedHere) {
      return (
        <Button asChild variant={variant} className={className}>
          <Link href={"/settings" as Route}>Manage billing</Link>
        </Button>
      );
    }
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={"/dashboard" as Route}>You&apos;re all set — Chef is unlocked</Link>
      </Button>
    );
  }

  if (!billingConfigured) {
    return (
      <Button type="button" disabled variant={variant} className={className}>
        Coming soon
      </Button>
    );
  }

  if (authState.kind === "anonymous") {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={"/sign-in?next=/pricing" as Route}>Sign in to upgrade</Link>
      </Button>
    );
  }

  if (subscribedHere) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={"/settings" as Route}>Your plan — manage billing</Link>
      </Button>
    );
  }

  return (
    <Button type="button" onClick={onUpgrade} disabled={pending} variant={variant} className={className}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {authState.kind === "active_subscriber" ? `Switch to ${tierName}` : `Choose ${tierName}`}
    </Button>
  );
}
