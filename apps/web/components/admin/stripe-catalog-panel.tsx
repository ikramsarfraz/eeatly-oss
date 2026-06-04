"use client";

import * as React from "react";
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Admin Stripe catalog viewer. Stripe is the source of truth for the sellable
 * catalog (tier prices + credit packs); this panel reads the live catalog and
 * offers a Sync action that busts our 5-minute in-memory cache so Dashboard
 * edits take effect immediately. Read-only otherwise: pricing and metadata are
 * edited in the Stripe Dashboard, not here.
 */
export function StripeCatalogPanel() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const catalogQuery = trpc.admin.stripeCatalog.useQuery();
  const sync = trpc.admin.syncStripeCatalog.useMutation({
    onSuccess: (data) => {
      utils.admin.stripeCatalog.setData(undefined, data);
      showToast({
        variant: "success",
        title: "Catalog synced",
        description: "Pulled the latest prices from Stripe."
      });
    },
    onError: (error) => {
      showToast({
        variant: "error",
        title: "Sync failed",
        description: error.message
      });
    }
  });

  const data = catalogQuery.data;
  const loading = catalogQuery.isLoading;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Stripe catalog</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tiers and credit packs are read live from Stripe. Edit a product or price in the
            Stripe Dashboard, then Sync to pull the changes through right away (otherwise they
            apply within 5 minutes).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://dashboard.stripe.com/products"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium text-foreground hover:bg-[var(--surface-2)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Stripe
          </a>
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={sync.isPending || loading}
            onClick={() => sync.mutate()}
          >
            {sync.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sync from Stripe
          </Button>
        </div>
      </div>

      {!loading && data && !data.configured ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--warning,#b7791f)]/40 bg-[color:var(--warning,#b7791f)]/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning,#b7791f)]" />
          <p>
            Stripe isn&apos;t configured in this environment, so checkout is disabled. The prices
            below are the in-app fallback values from <code className="font-mono-brand">lib/pricing.ts</code>.
            Set the Stripe env vars to sell live prices.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
        </div>
      ) : !data ? (
        <p className="py-10 text-sm text-muted-foreground">Couldn&apos;t load the catalog.</p>
      ) : (
        <>
          {/* Tiers */}
          <div className="grid gap-3 sm:grid-cols-3">
            {data.plans.map((plan) => (
              <Card key={plan.plan} className="overflow-hidden">
                <CardHeader className="gap-1.5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {plan.sellable ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--sage-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sage-fg)]">
                        <Check className="h-3 w-3" /> Live
                      </span>
                    ) : (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Fallback
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {plan.plan}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <PriceRow
                    label="Monthly"
                    live={plan.monthly?.display ?? null}
                    fallback={plan.fallback.monthly}
                    priceId={plan.monthly?.priceId ?? null}
                  />
                  <PriceRow
                    label="Annual"
                    live={plan.annual ? `${plan.annual.perMonth} / mo` : null}
                    sub={plan.annual ? `${plan.annual.display} / yr` : undefined}
                    fallback={`${plan.fallback.annualPerMonth} / mo`}
                    priceId={plan.annual?.priceId ?? null}
                  />
                  <div className="border-t pt-2 text-[12.5px] text-muted-foreground">
                    {plan.monthlyCredits.toLocaleString()} AI credits / month
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Credit packs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Credit top-up packs</CardTitle>
              <p className="text-[12.5px] text-muted-foreground">
                One-time prices tagged <code className="font-mono-brand">metadata.kind=credits</code>{" "}
                in Stripe. Add or retire a pack there, no code change needed.
              </p>
            </CardHeader>
            <CardContent>
              {data.packs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No credit packs configured in Stripe.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.packs.map((pack) => (
                    <li
                      key={pack.priceId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-medium text-foreground">
                        {pack.credits.toLocaleString()} credits
                      </span>
                      <span className="font-serif text-[18px] text-foreground">{pack.display}</span>
                      <code className="font-mono-brand text-[11px] text-muted-foreground">
                        {pack.priceId}
                      </code>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PriceRow({
  label,
  live,
  sub,
  fallback,
  priceId
}: {
  label: string;
  live: string | null;
  sub?: string;
  fallback: string;
  priceId: string | null;
}) {
  const isLive = live != null;
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={cn("font-serif text-[18px]", isLive ? "text-foreground" : "text-muted-foreground")}>
          {live ?? fallback}
        </span>
      </div>
      {sub ? <p className="text-right text-[11px] text-muted-foreground">{sub}</p> : null}
      {priceId ? (
        <code className="truncate font-mono-brand text-[10.5px] text-muted-foreground" title={priceId}>
          {priceId}
        </code>
      ) : (
        <span className="text-[10.5px] text-muted-foreground">no live price</span>
      )}
    </div>
  );
}
