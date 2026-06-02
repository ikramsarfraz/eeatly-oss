"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type PaidTier = "plus" | "pro";
const TIER_NAME: Record<string, string> = { free: "Cook", plus: "Chef", pro: "Master Chef" };
const RANK: Record<string, number> = { free: 0, plus: 1, pro: 2 };

function formatDate(iso: string | Date | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Settings → Plan. Shows the current tier, a "Manage billing" button (Stripe
 * portal — where you cancel/update card), and compact tier cards to upgrade /
 * switch. Prices come live from the Stripe catalog; annual shows the effective
 * per-month rate.
 */
export function PlanManager() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const subQuery = trpc.billing.currentSubscription.useQuery();
  const tierStatusQuery = trpc.billing.tierStatus.useQuery();
  const catalogQuery = trpc.billing.catalog.useQuery();
  const checkout = trpc.billing.createCheckoutSession.useMutation();
  const portal = trpc.billing.createPortalSession.useMutation();
  const [interval, setInterval] = React.useState<"monthly" | "annual">("annual");
  const busy = checkout.isPending || portal.isPending;

  const upgraded = useSearchParams().get("upgraded") === "true";
  React.useEffect(() => {
    if (!upgraded) return;
    void utils.billing.currentSubscription.invalidate();
    void utils.credits.balance.invalidate();
    showToast({ variant: "success", title: "You're all set", description: "Your plan is active." });
  }, [upgraded, showToast, utils]);

  const sub = subQuery.data;
  const active = sub?.status === "active" || sub?.status === "trialing";
  const onTrial = !active && Boolean(tierStatusQuery.data?.onTrial);
  const trialDaysLeft = tierStatusQuery.data?.trialDaysLeft ?? 0;
  // During the no-card trial the user has no subscription row, but their
  // effective tier is Pro — show that in the header, badged as a trial.
  const currentTier: string = active ? sub!.tier : onTrial ? "pro" : "free";
  // The cards' "Your plan" / upgrade state tracks only the *paid* tier — a
  // trial user hasn't subscribed, so both cards stay purchasable.
  const subscribedTier: string = active ? sub!.tier : "free";
  const catalog = catalogQuery.data;

  async function upgradeTo(tier: PaidTier) {
    if (busy) return;
    try {
      const session = await checkout.mutateAsync({ tier, interval });
      window.location.assign(session.url);
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't start checkout",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  async function manageBilling() {
    if (busy) return;
    try {
      const session = await portal.mutateAsync();
      window.location.assign(session.url);
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't open billing",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  const statusLine = active
    ? sub!.cancelAtPeriodEnd
      ? `Cancels ${formatDate(sub!.currentPeriodEnd)} — access until then.`
      : `Renews ${formatDate(sub!.currentPeriodEnd)}.`
    : onTrial
      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your Master Chef trial. Pick a plan to keep these features.`
      : "Free plan — AI runs on your monthly credit grant.";

  return (
    <section id="plan" className="grid gap-3 scroll-mt-24">
      <SectionLabel>Subscription</SectionLabel>
      <Card className="overflow-hidden p-5">
        {/* Current plan + manage billing */}
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[22px] text-foreground">
                {TIER_NAME[currentTier] ?? currentTier}
              </span>
              {active ? (
                <span className="rounded-full bg-[color:var(--sage-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sage-fg)]">
                  Active
                </span>
              ) : onTrial ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Trial
                </span>
              ) : null}
            </div>
            <p className="text-[12.5px] text-muted-foreground">{statusLine}</p>
          </div>
          {active ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
              onClick={manageBilling}
            >
              {portal.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Manage billing
            </Button>
          ) : null}
        </div>

        {/* Billing-period toggle */}
        <div
          className="mt-4 inline-flex w-fit gap-1 rounded-full border bg-[var(--surface-2)] p-1"
          role="tablist"
          aria-label="Billing period"
        >
          {(["annual", "monthly"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              role="tab"
              aria-selected={interval === opt}
              onClick={() => setInterval(opt)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-colors",
                interval === opt
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt}
              {opt === "annual" ? (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-px text-[9.5px] font-semibold text-primary">
                  2 mo free
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tier cards */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {(["plus", "pro"] as const).map((tier) => {
            const t = catalog?.[tier];
            const price = interval === "monthly" ? t?.monthly : t?.annual;
            const perMonth =
              interval === "monthly"
                ? price?.display
                : (t?.annual && "perMonthDisplay" in t.annual ? t.annual.perMonthDisplay : undefined);
            const isCurrent = subscribedTier === tier;
            const isUpgrade = RANK[tier] > RANK[subscribedTier];
            return (
              <div
                key={tier}
                className={cn(
                  "grid gap-2 rounded-xl border p-4",
                  isCurrent ? "border-primary/50 bg-[color:var(--sage-soft)]" : "border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {TIER_NAME[tier]}
                  </span>
                  {isCurrent ? (
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--sage-fg)]">
                      Current
                    </span>
                  ) : null}
                </div>
                <div>
                  <span className="font-serif text-[24px] text-foreground">{perMonth ?? "—"}</span>
                  <span className="ml-1 text-[12px] text-muted-foreground">/ mo</span>
                  {interval === "annual" && price ? (
                    <p className="text-[11px] text-muted-foreground">billed {price.display} yearly</p>
                  ) : null}
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {(t?.monthlyCredits ?? 0).toLocaleString()} AI credits / month
                </p>
                {isCurrent ? (
                  <Button type="button" variant="outline" size="sm" disabled className="h-9">
                    <Check className="h-3.5 w-3.5" />
                    Your plan
                  </Button>
                ) : !price ? (
                  <Button type="button" variant="outline" size="sm" disabled className="h-9">
                    Coming soon
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={busy}
                    onClick={() => upgradeTo(tier)}
                  >
                    {checkout.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {isUpgrade ? `Upgrade to ${TIER_NAME[tier]}` : `Switch to ${TIER_NAME[tier]}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
