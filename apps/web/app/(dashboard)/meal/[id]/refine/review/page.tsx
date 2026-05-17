"use client";

import * as React from "react";
import type { Route } from "next";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, Minus, Plus, Sparkles, TriangleAlert } from "lucide-react";
import type { HeadsUp, PendingChange } from "@eeatly/api/validators/refine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { SectionLabel } from "@/components/ui/section-label";
import { useToastShortcuts } from "@/components/ui/toast";
import {
  describePendingChange,
  summariseCounts,
  type DisplayChange
} from "@/lib/refine/format";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Round 22 — web Review screen.
 *
 * Mirrors `apps/mobile/app/(authed)/meal/[id]/refine/review.tsx`:
 * heads-up cards on top (server-computed via the R18 rule engine),
 * structured per-change diff cards in the middle, save / back at the
 * bottom. The session id rides in `?sessionId=` from the composer so
 * deep-linking + back-stack survive an accidental refresh.
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
      // Repaint the meal detail with the new structured rows (the R21
      // read path will surface them on navigation).
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
        <PageTitle
          kicker="Review changes"
          title="No refine session"
          size="m"
        />
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
        <PageTitle
          kicker="Review changes"
          title="Couldn’t load review"
          size="m"
        />
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

  if (counts.total === 0) {
    return (
      <article className="mx-auto grid w-full max-w-[720px] gap-4 px-4 pb-12 pt-3 sm:px-6 sm:pt-4">
        <PageTitle
          kicker="Review changes"
          title={meal.name}
          size="l"
          subtitle="Nothing to review — head back and send a prompt to start refining."
        />
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="w-fit"
        >
          Back to refine
        </Button>
      </article>
    );
  }

  const saving = saveMut.isPending;

  function handleSave() {
    if (!sessionId || saving) return;
    saveMut.mutate({ sessionId });
  }

  return (
    <article className="mx-auto grid w-full max-w-[720px] gap-6 px-4 pb-12 pt-3 sm:px-6 sm:pt-4">
      <PageTitle
        kicker="Review changes"
        title={meal.name}
        size="l"
        eyebrow={`${counts.total} change${counts.total === 1 ? "" : "s"} · ready to save`}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="sage">{`+${counts.add} addition${counts.add === 1 ? "" : "s"}`}</Badge>
        <Badge variant="wheat">{`~${counts.change} change${counts.change === 1 ? "" : "s"}`}</Badge>
        <Badge variant="ghost">{`${counts.remove} removal${counts.remove === 1 ? "" : "s"}`}</Badge>
      </div>

      {session.headsUp.length > 0 ? (
        <section className="grid gap-2">
          <SectionLabel>Heads up</SectionLabel>
          <ul className="grid list-none gap-2">
            {session.headsUp.map((headsUp) => (
              <li key={headsUp.id}>
                <HeadsUpCard headsUp={headsUp} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Diff</SectionLabel>
          <span
            className="text-[12px] text-muted-foreground/80"
            aria-hidden
            title="Bulk Accept all not implemented in this round"
          >
            Accept all
          </span>
        </div>
        <ul className="grid list-none divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {pending.map((change) => (
            <li key={change.id}>
              <ReviewRow change={change} resolverCtx={resolverCtx} />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-2 sm:flex sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={saving}
          className="min-h-[44px]"
        >
          Back to refine
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-[44px]"
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
      </div>
    </article>
  );
}

/* ─── Components ──────────────────────────────────────────── */

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
    <div className="grid gap-2 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <KindIcon kind={change.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-snug text-foreground">
            {display.title}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {display.typeLabel}
          </p>
        </div>
      </div>
      {display.before !== null || display.after !== null ? (
        <DiffLines display={display} />
      ) : null}
    </div>
  );
}

function DiffLines({ display }: { display: DisplayChange }) {
  return (
    <div className="ml-9 grid gap-1">
      {display.before !== null ? (
        <p
          className={cn(
            "font-mono text-[12px] text-muted-foreground",
            (display.verb === "Changed" || display.verb === "Removed") &&
              "line-through decoration-muted-foreground/60"
          )}
        >
          {display.before}
        </p>
      ) : null}
      {display.after !== null ? (
        <p className="font-mono text-[12px] font-semibold text-foreground">
          {display.after}
        </p>
      ) : null}
    </div>
  );
}

function KindIcon({ kind }: { kind: PendingChange["kind"] }) {
  if (kind === "add") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-[color:var(--secondary-foreground)]">
        <Plus className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (kind === "change") {
    return (
      // R23 — wheat tone is now a CSS variable pair (`--wheat` /
      // `--wheat-fg`), defined in `globals.css` with light + dark
      // siblings. Same visual contract; the swap on dark mode happens
      // through `prefers-color-scheme` automatically.
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-wheat text-[color:var(--wheat-fg)]">
        <ArrowRight className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]">
      <Minus className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

function HeadsUpCard({ headsUp }: { headsUp: HeadsUp }) {
  const warn = headsUp.severity === "warn";
  const Icon = warn ? TriangleAlert : Sparkles;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-3.5",
        warn
          ? "border-wheat bg-wheat/40"
          : "border-[var(--primary-soft)] bg-[var(--primary-soft)]/40"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          warn ? "text-[color:var(--wheat-fg)]" : "text-[color:var(--secondary-foreground)]"
        )}
      />
      <div className="grid gap-1">
        <p className="text-[13px] font-semibold text-foreground">
          {headsUp.title || "Heads up"}
        </p>
        <p className="text-[12.5px] leading-relaxed text-foreground/80">
          {headsUp.body}
        </p>
        {headsUp.suggestedAction ? (
          // R20 spec: render the label as muted, non-functional copy —
          // the action plumb-through stays deferred.
          <p className="mt-1 text-[12px] text-muted-foreground">
            {headsUp.suggestedAction.label}
          </p>
        ) : null}
      </div>
    </div>
  );
}
