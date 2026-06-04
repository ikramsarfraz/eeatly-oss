"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  Plus
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MealTile } from "@/components/ui/meal-tile";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * Round 28 — editorial Plans list.
 *
 * Two ordered sections:
 *   - "Scheduled" — 3-up grid of plan cards. The dashed empty-state
 *     card ("Plan an occasion") is always the last cell, even when
 *     plans exist — it doubles as the primary CTA on a populated
 *     view. Clicking routes to `/plans/new`.
 *   - "Drafts & ideas" — flat list of archived plans (the closest
 *     mapping to the design's "Drafts" concept; the schema has no
 *     `scheduledFor` / draft field today). Section hides entirely
 *     when no archived plans exist.
 *
 * The TopBar's right-side "New plan" action is registered here. The
 * old `<PlansList>` filter/archived-toggle is replaced — archived
 * plans surface inline in the Drafts section, so the toggle isn't
 * needed.
 *
 * Card visual:
 *   - Sage-tinted header band (date + display name + chip).
 *   - Body: up to 3 dish rows (28×28 MealTile + name); rest truncate
 *     into a small "+N more" tail.
 *   - Whole card wraps in `<Link>` for keyboard / right-click parity
 *     with R25's dashboard cards.
 */

export type PlansListItem = {
  id: string;
  name: string;
  scheduledDate: string;
  archivedAt: Date | string | null;
  dishCount: number;
  /**
   * R28 server can optionally include a thin slice of dish previews
   * for the card body. The shape stays optional — pages that don't
   * fetch dishes render an empty card body and the chip still
   * carries the count.
   */
  dishes?: Array<{ id: string; mealName: string; mealPhotoUrl: string | null }>;
};

type PlansClientProps = {
  plans: PlansListItem[];
};

export function PlansClient({ plans }: PlansClientProps) {
  const scheduled = plans.filter((p) => !p.archivedAt);
  const drafts = plans.filter((p) => Boolean(p.archivedAt));

  return (
    <div className="grid gap-7">
      {/* Header band — display title + description. Filter + Recent
          decorative buttons defer to a future round per spec. */}
      {/* `items-start` + `pt-1.5` on the action group cap-aligns the
          button to the top of the serif title's first line, rather than
          letting it float centered against the title+subtitle block. */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1
            className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[64px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Plans.
          </h1>
          <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
            Sketch out the weeks ahead. Eid menus, dinner parties, school-
            night rotations — whatever rhythm the kitchen runs on.
          </p>
        </div>
        {/* Primary action lives in the page header (not the top bar). */}
        <div className="pt-1.5">
          <Button asChild variant="default" className="min-h-[40px]">
            <Link href={"/plans/new" as Route}>
              <Plus className="h-3.5 w-3.5" />
              New plan
            </Link>
          </Button>
        </div>
      </header>

      {/* Scheduled grid — 3-up with empty-state always last */}
      <section aria-labelledby="scheduled-heading" className="grid gap-4">
        <SectionLabel id="scheduled-heading">Scheduled</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scheduled.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
          <EmptyStateCard />
        </div>
      </section>

      {/* Drafts — only rendered when archived plans exist. The schema
          has no real "draft" field today; archived plans are the
          closest fit for the design's "Drafts & ideas" concept. */}
      {drafts.length > 0 ? (
        <section aria-labelledby="drafts-heading" className="grid gap-3">
          <SectionLabel id="drafts-heading">Drafts &amp; ideas</SectionLabel>
          <Card className="overflow-hidden p-0">
            <ul className="grid divide-y divide-[var(--border-soft,var(--border))]">
              {drafts.map((plan) => (
                <li key={plan.id}>
                  <DraftRow plan={plan} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlansListItem }) {
  const dateLabel = (() => {
    try {
      return format(parseISO(plan.scheduledDate), "EEE, MMM d");
    } catch {
      return plan.scheduledDate;
    }
  })();
  const dishPreview = (plan.dishes ?? []).slice(0, 3);
  const overflow = plan.dishCount - dishPreview.length;

  return (
    <Link
      href={`/plans/${plan.id}` as Route}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Open plan ${plan.name}`}
    >
      <Card
        className="overflow-hidden p-0 transition-colors group-hover:border-[var(--border-strong,var(--border))]"
      >
        {/* Sage-tinted header band */}
        <header className="grid gap-2 bg-[color:var(--sage-soft)] px-[18px] py-4">
          <p
            className="font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            {dateLabel}
          </p>
          <h3
            className="font-serif text-[28px] leading-[1.04] text-foreground underline-offset-2 group-hover:underline"
            style={{ letterSpacing: "-0.02em" }}
          >
            {plan.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="sage" className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {plan.dishCount} {plan.dishCount === 1 ? "dish" : "dishes"}
            </Badge>
          </div>
        </header>
        {/* Body — `plans.list` returns dish counts but not preview rows
            today (N+1 queries to fetch them would be expensive at
            scale). The card stays light: just a quiet "tap to add"
            prompt when empty, or the chip in the header band carries
            the count when populated. A `dishes` slice can be passed
            in once the service supports it; this code path renders
            the previews when provided. */}
        <div className="px-[18px] py-3">
          {dishPreview.length > 0 ? (
            <ul className="grid gap-2">
              {dishPreview.map((dish) => (
                <li key={dish.id} className="flex items-center gap-2.5">
                  {dish.mealPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dish.mealPhotoUrl}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-md border bg-muted object-cover"
                    />
                  ) : (
                    <MealTile
                      name={dish.mealName}
                      size="s"
                      className="h-7 w-7 shrink-0"
                    />
                  )}
                  <span className="truncate text-[13px] text-foreground">
                    {dish.mealName}
                  </span>
                </li>
              ))}
              {overflow > 0 ? (
                <li
                  className="pl-1 font-mono text-[10.5px] uppercase text-muted-foreground"
                  style={{ letterSpacing: "0.14em" }}
                >
                  +{overflow} more
                </li>
              ) : null}
            </ul>
          ) : plan.dishCount === 0 ? (
            <p className="text-[12.5px] italic text-muted-foreground">
              No dishes yet. Open to add the first one.
            </p>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              {plan.dishCount}{" "}
              {plan.dishCount === 1 ? "dish" : "dishes"} scheduled.
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

function EmptyStateCard() {
  return (
    <Link
      href={"/plans/new" as Route}
      className="group flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-[var(--border-strong,var(--border))] bg-[var(--surface-2)] px-6 py-6 text-center transition-colors hover:border-primary hover:bg-[color:var(--sage-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Plan an occasion"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--sage)] text-[color:var(--sage-fg)]"
      >
        <Plus className="h-4 w-4" />
      </span>
      <span
        className="font-serif text-[22px] leading-tight text-foreground"
        style={{ letterSpacing: "-0.02em" }}
      >
        Plan an occasion.
      </span>
      <span
        className="font-mono text-[10.5px] uppercase text-muted-foreground"
        style={{ letterSpacing: "0.14em" }}
      >
        Eid · Diwali · dinner
      </span>
    </Link>
  );
}

function DraftRow({ plan }: { plan: PlansListItem }) {
  const dateLabel = (() => {
    try {
      return format(parseISO(plan.scheduledDate), "MMM d, yyyy");
    } catch {
      return plan.scheduledDate;
    }
  })();
  return (
    <Link
      href={`/plans/${plan.id}` as Route}
      className="grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 px-[18px] py-3 transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      aria-label={`Open plan ${plan.name}`}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-2)] text-muted-foreground"
      >
        <CalendarDays className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-foreground">
          {plan.name}
        </span>
        <span
          className="font-mono text-[10.5px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.13em" }}
        >
          {dateLabel} · {plan.dishCount}{" "}
          {plan.dishCount === 1 ? "dish" : "dishes"}
        </span>
      </div>
      <Badge variant="ghost" className="font-mono">
        Draft
      </Badge>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
