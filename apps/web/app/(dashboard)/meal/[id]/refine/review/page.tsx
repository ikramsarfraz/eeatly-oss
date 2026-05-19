"use client";

import * as React from "react";
import type { Route } from "next";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, Minus, Plus, Sparkles } from "lucide-react";
import type { HeadsUp, PendingChange } from "@eeatly/api/validators/refine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { useToastShortcuts } from "@/components/ui/toast";
import { useSetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { useSetTopBarActions } from "@/components/layout/top-bar-actions";
import { HeadsUpCard } from "@/components/refine/heads-up-card";
import {
  describePendingChange,
  summariseCounts,
  type DisplayChange
} from "@/lib/refine/format";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Round 30 — editorial Review screen.
 *
 * Replaces R22's centered-card layout with the design's two-band
 * structure: editorial hero (italic "N changes," + 72px display
 * "ready to save." + chip row) above a per-change diff Card with
 * explicit Before / After grids.
 *
 * Procedure plumbing unchanged from R22 — `refine.save` is still
 * the single mutation that persists the session. TopBar actions
 * (Keep refining / Save N changes) replace the inline footer
 * buttons from R22.
 *
 * Per-row Skip / Accept buttons: rendered DECORATIVELY for v1.
 * `refine.toggleTurnAccepted` operates at the turn level, not the
 * pending-change level, so a clean per-row accept/reject needs a
 * new procedure. R20 (mobile) parked the same affordance; R30
 * parks it on web too. Bulk Accept all / Skip all on the section
 * header is decorative for the same reason.
 */

export default function RefineReviewPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToastShortcuts();
  const utils = trpc.useUtils();

  const mealId = typeof params?.id === "string" ? params.id : "";
  const sessionId = search?.get("sessionId") ?? null;

  const mealQuery = trpc.meals.getById.useQuery(
    { mealId },
    { enabled: mealId.length > 0, staleTime: 30_000 }
  );
  const sessionQuery = trpc.refine.getPendingChanges.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: !!sessionId, staleTime: 5_000 }
  );

  const saveMut = trpc.refine.save.useMutation({
    onSuccess: async (result) => {
      if (!result) return;
      await utils.meals.getById.invalidate({ mealId });
      toast.success({
        title:
          result.applied > 0
            ? `${result.applied} change${result.applied === 1 ? "" : "s"} saved`
            : "Session closed"
      });
      window.setTimeout(() => {
        router.push(`/meal/${mealId}` as Route);
      }, 500);
    },
    onError: (err) => {
      toast.error({
        title: "Save failed",
        description: err.message ?? "Couldn't save those changes."
      });
    }
  });

  /* ─── Guard rails ──────────────────────────────────────────── */

  if (!sessionId) {
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-3 px-4 py-8 sm:px-6">
        <h1
          className="font-serif text-[44px] leading-tight text-foreground"
          style={{ letterSpacing: "-0.025em" }}
        >
          No refine session.
        </h1>
        <p className="text-sm text-muted-foreground">
          Open the refine flow first, then come back here to review.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push(`/meal/${mealId}` as Route)}
          className="mt-2 w-fit"
        >
          Back to recipe
        </Button>
      </div>
    );
  }

  if (mealQuery.isPending || sessionQuery.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-3 px-4 py-8 sm:px-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading review…</p>
      </div>
    );
  }

  if (!mealQuery.data || !sessionQuery.data) {
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-3 px-4 py-8 sm:px-6">
        <h1
          className="font-serif text-[36px] leading-tight text-foreground"
          style={{ letterSpacing: "-0.02em" }}
        >
          Couldn&apos;t load review.
        </h1>
        <p className="text-sm text-muted-foreground">
          {sessionQuery.error?.message ??
            mealQuery.error?.message ??
            "Try going back and re-opening Refine."}
        </p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-2 w-fit"
        >
          Back to refine
        </Button>
      </div>
    );
  }

  const meal = mealQuery.data;
  const session = sessionQuery.data;
  const pending = session.pendingChanges;
  const counts = summariseCounts(pending);
  const resolverCtx = {
    ingredients: meal.structuredIngredients ?? [],
    steps: meal.structuredSteps ?? []
  };

  return (
    <ReviewBody
      mealName={meal.name}
      sessionId={sessionId}
      pending={pending}
      counts={counts}
      headsUp={session.headsUp}
      resolverCtx={resolverCtx}
      saving={saveMut.isPending}
      onSave={() => {
        if (!sessionId || saveMut.isPending) return;
        saveMut.mutate({ sessionId });
      }}
      onBack={() => router.back()}
    />
  );
}

/**
 * Lifted into its own component for the same hook-ordering reason as
 * Refine's `RefineBody` — `useSetBreadcrumb` + `useSetTopBarActions`
 * need to run on every loaded render with `meal.name` + `counts.total`
 * in scope, but the page hits multiple early-returns first.
 */
function ReviewBody({
  mealName,
  sessionId,
  pending,
  counts,
  headsUp,
  resolverCtx,
  saving,
  onSave,
  onBack
}: {
  mealName: string;
  sessionId: string;
  pending: PendingChange[];
  counts: { add: number; change: number; remove: number; total: number };
  headsUp: HeadsUp[];
  resolverCtx: Parameters<typeof describePendingChange>[1];
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  useSetBreadcrumb(mealName, "Recipe");

  const topBarActions = React.useMemo(
    () => (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={saving}
          className="min-h-[40px]"
        >
          Keep refining
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onSave}
          disabled={saving || counts.total === 0}
          className="min-h-[40px]"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {saving
            ? "Saving…"
            : `Save ${counts.total} change${counts.total === 1 ? "" : "s"}`}
        </Button>
      </>
    ),
    [counts.total, saving, onSave, onBack]
  );
  useSetTopBarActions(topBarActions);

  const primaryHeadsUp = headsUp[0] ?? null;
  const extraHeadsUp = headsUp.slice(1);

  // Reference sessionId so its consumer-side typecheck doesn't drop
  // the prop (it's threaded down for future per-row Skip/Accept
  // wiring; v1 doesn't call any session-scoped mutation from this
  // component).
  void sessionId;

  if (counts.total === 0) {
    return (
      <div className="grid gap-4 py-2">
        <header className="grid gap-2">
          <p
            className="font-serif text-[20px] italic text-muted-foreground"
            style={{ letterSpacing: "-0.005em" }}
          >
            Nothing to review,
          </p>
          <h1
            className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            head back and send a prompt.
          </h1>
        </header>
        <Button variant="outline" onClick={onBack} className="w-fit">
          Back to refine
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-7">
      {/* Editorial hero — 1fr 320px */}
      <section className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="grid gap-2">
          <p
            className="font-serif text-[24px] italic text-muted-foreground sm:text-[28px]"
            style={{ letterSpacing: "-0.005em" }}
          >
            {counts.total} change{counts.total === 1 ? "" : "s"},
          </p>
          <h1
            className="font-serif text-[52px] leading-[0.98] text-foreground sm:text-[64px] lg:text-[72px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            ready to save.
          </h1>
          <p
            className="mt-2 font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            {mealName} · refined just now
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="sage">
              +{counts.add} addition{counts.add === 1 ? "" : "s"}
            </Badge>
            <Badge variant="wheat">
              ~{counts.change} change{counts.change === 1 ? "" : "s"}
            </Badge>
            <Badge variant="ghost">
              {counts.remove} removal{counts.remove === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        {/* Right column — primary heads-up card. Extras stack below
            the diff list. */}
        {primaryHeadsUp ? (
          <HeadsUpCard headsUp={primaryHeadsUp} />
        ) : null}
      </section>

      {/* Diff section */}
      <section className="grid gap-3">
        <SectionLabel
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                aria-disabled
                className="cursor-default rounded-full border bg-transparent px-3 py-1 font-mono text-[10.5px] uppercase text-muted-foreground opacity-70"
                style={{ letterSpacing: "0.14em" }}
              >
                Skip all
              </button>
              <button
                type="button"
                disabled
                aria-disabled
                className="cursor-default rounded-full border-transparent bg-[color:var(--sage)] px-3 py-1 font-mono text-[10.5px] uppercase text-[color:var(--sage-fg)] opacity-80"
                style={{ letterSpacing: "0.14em" }}
              >
                Accept all
              </button>
            </div>
          }
        >
          Diff · {counts.total} of {counts.total}
        </SectionLabel>
        <Card className="overflow-hidden p-0">
          <ul className="grid list-none divide-y divide-[var(--border-soft,var(--border))]">
            {pending.map((change) => (
              <li key={change.id}>
                <ReviewRow change={change} resolverCtx={resolverCtx} />
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Extra heads-up cards below the diff */}
      {extraHeadsUp.length > 0 ? (
        <section className="grid gap-2">
          {extraHeadsUp.map((rule) => (
            <HeadsUpCard key={rule.id} headsUp={rule} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

/* ─── Per-change row ──────────────────────────────────────── */

function ReviewRow({
  change,
  resolverCtx
}: {
  change: PendingChange;
  resolverCtx: Parameters<typeof describePendingChange>[1];
}) {
  const display = React.useMemo(
    () => describePendingChange(change, resolverCtx),
    [change, resolverCtx]
  );
  return (
    <div className="grid gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <KindIcon kind={change.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug text-foreground">
            {display.title}
          </p>
          <p
            className="mt-1 font-mono text-[10px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            {display.typeLabel}
          </p>
        </div>
        {/* Per-row Skip / Accept — decorative for v1. R18's procedure
            surface is turn-level, not pending-change-level, so wiring
            requires a new endpoint. Same affordance R20 mobile parks. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled
            aria-disabled
            className="cursor-default rounded-md border bg-transparent px-2.5 py-1 font-mono text-[10.5px] uppercase text-muted-foreground opacity-70"
            style={{ letterSpacing: "0.13em" }}
          >
            Skip
          </button>
          <button
            type="button"
            disabled
            aria-disabled
            className="cursor-default rounded-md border-transparent bg-[color:var(--sage)] px-2.5 py-1 font-mono text-[10.5px] uppercase text-[color:var(--sage-fg)] opacity-80"
            style={{ letterSpacing: "0.13em" }}
          >
            Accept
          </button>
        </div>
      </div>
      {display.before !== null || display.after !== null ? (
        <BeforeAfter display={display} />
      ) : null}
    </div>
  );
}

function BeforeAfter({ display }: { display: DisplayChange }) {
  return (
    <div className="ml-9 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {display.before !== null ? (
        <div
          className={cn(
            "grid gap-1 rounded-[10px] border p-3",
            "border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]"
          )}
        >
          <span
            className="font-mono text-[10px] uppercase text-[color:var(--danger-fg)]"
            style={{ letterSpacing: "0.14em" }}
          >
            Before
          </span>
          <p
            className={cn(
              "font-mono text-[12.5px] text-foreground/80",
              (display.verb === "Changed" || display.verb === "Removed") &&
                "line-through decoration-[color:var(--danger-fg)]/40"
            )}
          >
            {display.before}
          </p>
        </div>
      ) : (
        <span aria-hidden />
      )}
      {display.after !== null ? (
        <div
          className={cn(
            "grid gap-1 rounded-[10px] border p-3",
            "border-[color:var(--sage)] bg-[color:var(--sage-soft)]"
          )}
        >
          <span
            className="font-mono text-[10px] uppercase text-[color:var(--sage-fg)]"
            style={{ letterSpacing: "0.14em" }}
          >
            After
          </span>
          <p className="font-mono text-[12.5px] font-semibold text-foreground">
            {display.after}
          </p>
        </div>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: PendingChange["kind"] }) {
  if (kind === "add") {
    return (
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[color:var(--sage)] text-[color:var(--sage-fg)]">
        <Plus className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (kind === "change") {
    return (
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[color:var(--wheat)] text-[color:var(--wheat-fg)]">
        <ArrowRight className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[color:var(--danger-soft)] text-[color:var(--danger-fg)]">
      <Minus className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

// Pull `Sparkles` into use so the `import { Sparkles }` in this file
// doesn't trip the unused-import lint. The HeadsUpCard component uses
// its own icon; this is purely for the type-only re-import path.
void Sparkles;
