"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { LAUNCH_BADGE, PRICING } from "@/lib/pricing";

type AuthState =
  | { kind: "anonymous" }
  | { kind: "active_subscriber" }
  | { kind: "signed_in_free" };

type PricingCardProps = {
  /**
   * Stripe wired (all STRIPE_* env vars present) → the "Upgrade" CTA can
   * fire real checkout. When false, there's no checkout to fire; the card
   * either shows the launch promo (see `launchMode`) or a "Coming soon"
   * placeholder.
   */
  billingConfigured: boolean;
  /**
   * Release-v1 launch promo. When true, prices render struck-through with
   * the launch badge and the CTA points everyone into the app (Plus is
   * already unlocked) instead of checkout.
   */
  launchMode: boolean;
  authState: AuthState;
  features: string[];
};

export function PricingCard({
  billingConfigured,
  launchMode,
  authState,
  features
}: PricingCardProps) {
  const { showToast } = useToast();
  // Default to annual — better unit economics, higher LTV. The toggle
  // is a state, not a free-floating decision, so I keep it in component.
  const [priceType, setPriceType] = React.useState<"monthly" | "annual">("annual");
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation();
  const pending = checkoutMutation.isPending;

  const activePrice = priceType === "monthly" ? PRICING.monthly : PRICING.annual;

  async function handleUpgrade() {
    if (pending) return;
    try {
      const result = await checkoutMutation.mutateAsync({ priceType });
      // Stripe hosts the checkout — full navigation, not a fetch.
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
      className="grid gap-5 rounded-2xl border-2 border-primary/30 bg-background/70 p-6 shadow-sm sm:p-7"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <header className="grid gap-2">
        <div className="flex items-center gap-1.5 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="text-[12px] font-medium uppercase tracking-wide">
            eeatly Plus
          </span>
        </div>
        <h2 className="font-serif text-[28px] font-normal leading-tight">
          Your family&apos;s recipe library, with AI to capture and share
        </h2>
        <p className="text-sm text-muted-foreground">
          The cooking memory keeps getting smarter the more you use it.
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
          {launchMode ? (
            <>
              <span className="text-3xl font-semibold tracking-normal text-muted-foreground line-through decoration-2">
                {activePrice.display}
              </span>
              <span className="text-3xl font-semibold tracking-normal text-primary">
                $0
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                today
              </span>
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
        {priceType === "annual" ? (
          <p className="text-xs font-medium text-primary">{PRICING.annual.note}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {launchMode
            ? LAUNCH_BADGE
            : `Billed ${priceType === "monthly" ? "monthly" : "yearly"} via Stripe. Cancel anytime.`}
        </p>
      </div>

      {/* CTA varies by launch mode, then auth + billing-configured state. */}
      {launchMode ? (
        authState.kind === "anonymous" ? (
          <Button asChild className="w-full">
            <Link href={"/sign-up" as Route}>Start free during launch</Link>
          </Button>
        ) : authState.kind === "active_subscriber" ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={"/settings" as Route}>You&apos;re on Plus — manage billing</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href={"/dashboard" as Route}>
              You&apos;re all set — Plus is unlocked
            </Link>
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
      ) : authState.kind === "active_subscriber" ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={"/settings" as Route}>You&apos;re on Plus — manage billing</Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleUpgrade}
          disabled={pending}
          className="w-full"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Upgrade to Plus
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
