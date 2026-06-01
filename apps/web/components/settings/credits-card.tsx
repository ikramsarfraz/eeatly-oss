"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";

const TIER_LABEL: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro" };

/**
 * Settings → AI credits. Shows the user's balance (monthly grant + rolled-over
 * top-ups) and lets them buy one-time top-up packs via Stripe Checkout.
 */
export function CreditsCard() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const balanceQuery = trpc.credits.balance.useQuery();
  const catalogQuery = trpc.credits.catalog.useQuery();
  const buy = trpc.credits.buy.useMutation();
  const pending = buy.isPending;

  // Returning from a successful credit purchase (?credits=true) — refresh the
  // balance + confirm once.
  const credited = useSearchParams().get("credits") === "true";
  React.useEffect(() => {
    if (!credited) return;
    void utils.credits.balance.invalidate();
    showToast({ variant: "success", title: "Credits added", description: "Your top-up is ready to use." });
  }, [credited, showToast, utils]);

  async function handleBuy(priceId: string) {
    if (pending) return;
    try {
      const session = await buy.mutateAsync({ priceId });
      window.location.assign(session.url);
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't start checkout",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  const balance = balanceQuery.data;
  const packs = catalogQuery.data?.packs ?? [];

  return (
    <section id="credits" className="grid gap-3 scroll-mt-24">
      <SectionLabel>AI credits</SectionLabel>
      <Card className="overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex items-center gap-1.5 text-primary">
              <Zap className="h-4 w-4" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-wide">
                Balance
              </span>
            </div>
            {balance ? (
              <>
                <p className="font-serif text-[32px] leading-none text-foreground">
                  {balance.total.toLocaleString()}
                  <span className="ml-1.5 align-middle text-[13px] text-muted-foreground">
                    credits
                  </span>
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  {balance.monthlyRemaining.toLocaleString()} of{" "}
                  {balance.monthlyGrant.toLocaleString()} monthly ·{" "}
                  {balance.topupRemaining.toLocaleString()} top-up
                </p>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Loading…</p>
            )}
          </div>
          {balance ? (
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {TIER_LABEL[balance.tier] ?? balance.tier} plan
            </span>
          ) : null}
        </div>

        <p className="mt-4 mb-2 text-[12.5px] text-muted-foreground">
          AI prefill, Refine, and ingredient extraction spend credits. Your
          monthly grant resets each month; top-ups never expire.
        </p>

        <div className="flex flex-wrap gap-2">
          {packs.map((pack) => (
            <Button
              key={pack.priceId}
              type="button"
              variant="outline"
              className="h-10"
              disabled={pending}
              onClick={() => handleBuy(pack.priceId)}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {pack.label} · {pack.display}
            </Button>
          ))}
        </div>
      </Card>
    </section>
  );
}
