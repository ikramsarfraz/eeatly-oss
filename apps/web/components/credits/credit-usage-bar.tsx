"use client";

import * as React from "react";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { AI_CREDIT_COSTS } from "@/lib/pricing";

/**
 * Always-on aggregate credit meter for AI surfaces (capture, refine, recipe).
 *
 * Hybrid cost model (see docs): this single bar is the only persistent cost
 * element — cheap 1–2 credit ops are absorbed by it silently (no per-action
 * labels), and only the 10-credit image generation gets its own badge +
 * confirm (see `GenerateImageButton`). The bar animates its width and flashes
 * a transient "−N" when the balance drops, so relative cost is taught by
 * watching it move rather than by reading labels.
 *
 * Reads `trpc.credits.balance`; cheap ops invalidate that query on success so
 * the bar reflects the spend. Source of truth is always the server.
 */

/** Curated cost rows for the "How credits work" disclosure, derived from the
 *  single-source-of-truth cost table so they can't drift, and sorted cheapest
 *  first so the list reads as a clear ascending ladder. */
const COST_ROWS: ReadonlyArray<{ label: string; cost: number }> = [
  { label: "Capture or refine from text", cost: AI_CREDIT_COSTS.suggest_text },
  { label: "Capture or refine from voice or photo", cost: AI_CREDIT_COSTS.suggest_voice },
  { label: "Extract ingredients", cost: AI_CREDIT_COSTS.extract_ingredients },
  { label: "Create a share link", cost: AI_CREDIT_COSTS.share_recipe },
  { label: "Generate a dish image", cost: AI_CREDIT_COSTS.dish_image }
]
  .slice()
  .sort((a, b) => a.cost - b.cost);

type CreditUsageBarProps = {
  className?: string;
  /** Hide the "How credits work" toggle (e.g. in tight inline contexts). */
  hideDisclosure?: boolean;
};

export function CreditUsageBar({ className, hideDisclosure }: CreditUsageBarProps) {
  const balanceQuery = trpc.credits.balance.useQuery();
  const balance = balanceQuery.data;
  const [open, setOpen] = React.useState(false);

  // Transient "−N" flash: remember the last total, and when it drops, flash
  // the delta. Keyed so re-flashing restarts the animation.
  const prevTotal = React.useRef<number | null>(null);
  const [flash, setFlash] = React.useState<{ amount: number; key: number } | null>(null);

  React.useEffect(() => {
    if (!balance) return;
    const prev = prevTotal.current;
    prevTotal.current = balance.total;
    if (prev !== null && balance.total < prev) {
      setFlash({ amount: prev - balance.total, key: Date.now() });
    }
  }, [balance]);

  React.useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1100);
    return () => clearTimeout(t);
  }, [flash]);

  if (!balance) {
    return (
      <div
        className={cn(
          "h-[46px] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-2)]",
          className
        )}
        aria-hidden
      />
    );
  }

  const denom = Math.max(balance.monthlyGrant, balance.total, 1);
  const pct = Math.max(0, Math.min(100, Math.round((balance.total / denom) * 100)));
  const low = balance.total <= Math.max(10, Math.round(balance.monthlyGrant * 0.1));

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Zap
            className={cn("h-3.5 w-3.5", low ? "text-[var(--accent)]" : "text-[var(--primary)]")}
            aria-hidden
          />
          <span className="relative text-[13px] text-foreground">
            <span className="font-medium">{balance.total.toLocaleString()}</span>
            <span className="text-muted-foreground"> credits left</span>
            {flash ? (
              <span
                key={flash.key}
                className="credit-spend-flash pointer-events-none absolute -top-3 left-0 text-[12px] font-semibold text-[var(--accent)]"
                aria-hidden
              >
                −{flash.amount}
              </span>
            ) : null}
          </span>
        </div>
        {hideDisclosure ? null : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={open}
          >
            How credits work
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[600ms] ease-out",
            low ? "bg-[var(--accent)]" : "bg-[var(--primary)]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {open && !hideDisclosure ? (
        <dl className="mt-3 grid gap-1.5 border-t border-[var(--border)] pt-3">
          {COST_ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-[12.5px]">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-mono text-foreground">
                {row.cost} {row.cost === 1 ? "credit" : "credits"}
              </dd>
            </div>
          ))}
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Your monthly grant resets each month; top-ups never expire.
          </p>
        </dl>
      ) : null}
    </div>
  );
}
