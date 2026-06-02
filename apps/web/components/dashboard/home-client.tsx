"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  differenceInCalendarDays,
  format,
  isFuture,
  parseISO
} from "date-fns";
import { Calendar, Plus, Sparkles } from "lucide-react";
import { useCreateMealLogImperative } from "@/hooks/use-dashboard-meals";
import { useDashboardMeals } from "@/hooks/use-dashboard-meals";
import { useToast } from "@/components/providers/toast-provider";
import { getCause } from "@/lib/trpc/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MealTile } from "@/components/ui/meal-tile";
import { SectionLabel } from "@/components/ui/section-label";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type {
  DashboardMeals,
  RecentMeal,
  MealStat,
  RediscoverySuggestion
} from "@/types";

/**
 * Round 26 — Home (formerly /dashboard) client.
 *
 * Mirrors the design's editorial hero + 4-up stats + two-column body
 * (recents / most cooked / worth resurfacing on the left, upcoming
 * plan + quick log on the right). Renders inside the R26 app shell,
 * which provides the sidebar + top bar via the dashboard layout.
 *
 * State sources:
 *   - `dashboardMeals` — server-fetched in the page wrapper, hydrated
 *     into the existing `useDashboardMeals` hook so log-again /
 *     mutation flows continue to share the cache with the old code.
 *   - `plans.list` — read client-side for the upcoming-plan card. The
 *     plan list is cheap; SSR-shipping it would couple this client to
 *     the page wrapper for a single section. Loading + empty are
 *     handled inline.
 *   - `households.pendingInvitations` — owner-only; fired only when
 *     `isHouseholdOwner` so members don't 403. Non-owners see the 4th
 *     stat as "—" rather than the section collapsing. (Per R26 spec's
 *     "Drop the fourth if no count query exists.")
 *
 * TopBar action registered via `useSetTopBarActions`: a single
 * "New plan" CTA that routes to /plans/new. The provider unmounts the
 * action automatically on route change.
 */

function timeOfDayKicker(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  if (h < 21) return "Good evening,";
  return "Tonight,";
}

function firstName(name: string | null | undefined): string {
  if (!name) return "Welcome";
  const trimmed = name.trim();
  if (!trimmed) return "Welcome";
  const first = trimmed.split(/\s+/)[0];
  return first || "Welcome";
}

function countLoggedThisWeek(recent: RecentMeal[]): number {
  let n = 0;
  for (const row of recent) {
    if (!row.cookedAt) continue;
    const days = differenceInCalendarDays(new Date(), parseISO(row.cookedAt));
    if (days >= 0 && days <= 6) n += 1;
  }
  return n;
}

function approximateLibrarySize(meals: DashboardMeals): number {
  // `dashboard.meals` doesn't surface a total-distinct-meal count;
  // this approximation unions the three visible lists and counts
  // distinct ids. Capped by the underlying query limits (recent 10 +
  // most 6 + neglected ~6), so it under-counts large libraries.
  // Accurate-total-meals is a future query; flagged in the PR.
  const ids = new Set<string>();
  for (const row of meals.recentMeals) ids.add(row.mealId);
  for (const row of meals.mostCookedMeals) ids.add(row.mealId);
  for (const row of meals.neglectedMeals) ids.add(row.mealId);
  return ids.size;
}

export function HomeClient({
  initialData,
  currentUserName,
  isHouseholdOwner = false
}: {
  initialData: DashboardMeals;
  /** Unused for v1 — kept on the prop surface so future personalisation
   *  (e.g. owner-vs-member chips) doesn't need a layout refactor. */
  currentUserId?: string;
  currentUserName: string | null;
  /** Owner of the current household — gates the owner-only invites stat. */
  isHouseholdOwner?: boolean;
}) {
  const { showToast } = useToast();
  const { data } = useDashboardMeals(initialData);
  const meals = data ?? initialData;

  const today = new Date();
  const dateLabel = format(today, "EEE, MMM d").toUpperCase();

  // Upcoming plan: take the next plan whose scheduledDate is in the
  // future. `plans.list` returns rows sorted by date by default; we
  // re-filter here in case the server returns archived/past rows.
  const plansQuery = trpc.plans.list.useQuery(undefined, {
    staleTime: 60_000
  });
  const upcomingPlan = React.useMemo(() => {
    const list = plansQuery.data ?? [];
    return (
      list
        .filter((p) => !p.archivedAt)
        .filter(
          (p) =>
            p.scheduledDate &&
            (isFuture(parseISO(p.scheduledDate)) ||
              differenceInCalendarDays(parseISO(p.scheduledDate), today) === 0)
        )
        .sort(
          (a, b) =>
            parseISO(a.scheduledDate ?? "").getTime() -
            parseISO(b.scheduledDate ?? "").getTime()
        )[0] ?? null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansQuery.data]);

  // Pending invitations stat — owner-only procedure. Gated to owners so
  // members never fire it (a member call would 403 and log a spurious
  // `unauthorized_household_owner_access` error). Members get a "—"
  // placeholder; the stat section stays 4-up either way.
  const pendingInvitesQuery = trpc.households.pendingInvitations.useQuery(
    undefined,
    {
      staleTime: 60_000,
      enabled: isHouseholdOwner,
      // Belt-and-suspenders: don't burn retries if it ever 403s.
      retry: false
    }
  );
  const pendingInvitesCount = pendingInvitesQuery.data?.length ?? null;

  // Stats — derived from already-fetched dashboard data plus the
  // optional pending-invites count. The "in library" stat is the
  // approximate distinct-meal count noted above.
  const loggedThisWeek = countLoggedThisWeek(meals.recentMeals);
  const inLibrary = approximateLibrarySize(meals);
  const reliableRepeats = meals.mostCookedMeals.filter(
    (m) => m.cookCount > 1
  ).length;

  // Quick log — minimal form that calls meals.createLog with
  // R29 — Quick log buttons now route to the dedicated capture pages
  // instead of submitting inline. "Log meal" pushes to `/add/log`
  // with the typed name pre-filled via `?name=…`; "AI" pushes to
  // `/add/ai`. The input stays as a name-capture before nav so the
  // jump-to-page is one click + one keystroke for the common case.
  const router = useRouter();
  const [quickLogName, setQuickLogName] = React.useState("");
  const createLog = useCreateMealLogImperative({ source: "quick_log" });

  function handleQuickLog(e?: React.FormEvent) {
    e?.preventDefault();
    const name = quickLogName.trim();
    if (name.length > 0) {
      router.push(
        `/add/log?name=${encodeURIComponent(name)}` as Route
      );
    } else {
      router.push("/add/log" as Route);
    }
  }

  // Retained import for any future inline submit consumer — the R29
  // routing change moved the actual submit to /add/log, but the hook
  // stays imported so a follow-up that wants the imperative path back
  // doesn't need a fresh import rejig.
  void createLog;
  void showToast;
  void getCause;

  const recentTiles = meals.recentMeals.slice(0, 5);
  const mostCookedTiles = meals.mostCookedMeals.slice(0, 3);
  const worthResurfacing = meals.suggestions.slice(0, 3);

  return (
    <div className="grid gap-7">
      {/* Hero band — editorial only, no action. The dashboard's single
          "New plan" CTA lives in the Upcoming-plan card (one primary per
          screen); the hero stays clean. */}
      <section className="pt-2 sm:pt-4">
        <div className="grid gap-2">
          <p className="font-serif text-[20px] italic text-muted-foreground sm:text-[22px]">
            {timeOfDayKicker()}
          </p>
          <h1
            className="font-serif text-[56px] font-normal leading-[0.95] text-foreground max-md:text-[44px] sm:text-[72px] lg:text-[88px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {firstName(currentUserName)}.
          </h1>
          <p
            className="mt-1 font-mono text-[11px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            {dateLabel}
          </p>
          <p className="mt-2 max-w-[640px] text-[15px] leading-[1.55] text-muted-foreground">
            You&apos;ve cooked{" "}
            <strong className="text-foreground">{loggedThisWeek}</strong>{" "}
            {loggedThisWeek === 1 ? "meal" : "meals"} this week.
            {upcomingPlan ? (
              <>
                {" "}Next up:{" "}
                <em className="font-serif italic text-foreground">
                  {upcomingPlan.name}
                </em>
                .
              </>
            ) : (
              <> Plan something to cook this week.</>
            )}
          </p>
        </div>
      </section>

      {/* Stats — 4-up. Pending invites degrades to em-dash for non-
          owners; we keep the slot for layout stability. */}
      <section
        aria-label="Kitchen stats"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      >
        <StatCard
          label="Logged this week"
          value={loggedThisWeek}
          tone="sage"
        />
        <StatCard label="In library" value={inLibrary} tone="plain" />
        <StatCard
          label="Reliable repeats"
          value={reliableRepeats}
          tone="plain"
        />
        <StatCard
          label="Pending invites"
          value={pendingInvitesCount ?? "—"}
          tone="wheat"
        />
      </section>

      {/* Two-column body. 340px right column; `items-start` keeps the
          right column hugging its content (no stretch) so its sticky
          panels size to content rather than the taller left column. */}
      <div className="grid items-start gap-7 lg:grid-cols-[1fr_340px] lg:gap-9">
        <div className="grid gap-7">
          {/* Recently cooked — 5-up MealTile carousel-ish row. Each
              tile links to /meal/[id] for R25 parity. */}
          <section aria-labelledby="recents-heading" className="grid gap-3">
            <SectionLabel
              id="recents-heading"
              action={
                <Link
                  href={"/history" as Route}
                  className="text-[11.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  See all →
                </Link>
              }
            >
              Recently cooked
            </SectionLabel>
            {recentTiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {recentTiles.map((row) => (
                  <RecentTile key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <EmptyTile label="No recent cooks yet" />
            )}
          </section>

          {/* Most cooked — 3-up cards with full-width tile + cook
              count + last-cooked label. */}
          <section
            aria-labelledby="most-cooked-heading"
            className="grid gap-3"
          >
            <SectionLabel
              id="most-cooked-heading"
              action={
                <Link
                  href={"/history" as Route}
                  className="text-[11.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  See all →
                </Link>
              }
            >
              Most cooked
            </SectionLabel>
            {mostCookedTiles.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mostCookedTiles.map((meal) => (
                  <MostCookedTile key={meal.mealId} meal={meal} />
                ))}
              </div>
            ) : (
              <EmptyTile label="Cook a meal twice and it'll show up here" />
            )}
          </section>

          {/* Worth resurfacing — three rows pulled from rediscovery
              suggestions, with the decorative "Cook tonight" sage
              chip per spec. Each row navigates to /meal/[id]. */}
          <section
            aria-labelledby="resurface-heading"
            className="grid gap-3"
          >
            <SectionLabel id="resurface-heading">
              Worth resurfacing
            </SectionLabel>
            {worthResurfacing.length > 0 ? (
              <div className="overflow-hidden rounded-[14px] border bg-[var(--surface)]">
                {worthResurfacing.map((s, idx) => (
                  <ResurfaceRow
                    key={s.id}
                    suggestion={s}
                    isLast={idx === worthResurfacing.length - 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyTile label="Log more meals to surface ideas worth resurfacing." />
            )}
          </section>
        </div>

        {/* Right column — Upcoming plan + Quick log. Content-height flex
            stack that pins below the top bar once scrolled (lg+). */}
        <aside className="grid gap-5 self-start lg:sticky lg:top-[88px]">
          <UpcomingPlanCard plan={upcomingPlan} />

          <div
            className="grid gap-3 rounded-[14px] border bg-[var(--surface)] p-[18px]"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <SectionLabel>Quick log</SectionLabel>
            <form onSubmit={handleQuickLog} className="grid gap-2.5">
              <Input
                value={quickLogName}
                onChange={(e) => setQuickLogName(e.target.value)}
                placeholder="What did you cook?"
                className="font-serif italic placeholder:italic"
                aria-label="Meal name"
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                  type="submit"
                  variant="default"
                  className="min-h-[40px]"
                >
                  Log meal
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[40px]"
                  onClick={() => router.push("/add/ai" as Route)}
                >
                  AI
                </Button>
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                Opens the full form. Pre-fills the name if you typed one.
              </p>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone: "sage" | "wheat" | "plain";
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border p-4 transition-colors",
        // Light tone tints — read from the R26 sidebar palette + R23's
        // wheat tokens so the stat cards inherit dark mode for free. Per
        // the handoff only the first (sage) and last (wheat) cards are
        // tinted; the middle pair stays plain white surface.
        tone === "sage"
          ? "bg-[color:var(--sage-soft)] border-[color:var(--sage)]"
          : tone === "wheat"
            ? "bg-[color:var(--wheat-soft)] border-[color:var(--wheat)]"
            : "bg-[var(--surface)] border-[var(--border)]"
      )}
    >
      <p
        className="font-mono text-[10.5px] uppercase text-muted-foreground"
        style={{ letterSpacing: "0.14em" }}
      >
        {label}
      </p>
      <p
        className="mt-2 font-serif text-[42px] leading-none text-foreground"
        style={{ letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
    </div>
  );
}

function RecentTile({ row }: { row: RecentMeal }) {
  return (
    <Link
      href={`/meal/${row.mealId}` as Route}
      className="group grid gap-2 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Open recipe for ${row.mealName}`}
    >
      {row.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.photoUrl}
          alt=""
          className="aspect-square w-full rounded-md border bg-muted object-cover"
        />
      ) : (
        <MealTile name={row.mealName} size="m" className="aspect-square w-full border" />
      )}
      <div className="grid gap-0.5">
        <span className="truncate text-[13px] font-medium text-foreground group-hover:underline">
          {row.mealName}
        </span>
        <span className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
          {row.cookedAt
            ? format(parseISO(row.cookedAt), "MMM d")
            : "—"}
        </span>
      </div>
    </Link>
  );
}

function MostCookedTile({ meal }: { meal: MealStat }) {
  const days = meal.lastCookedAt
    ? differenceInCalendarDays(new Date(), parseISO(meal.lastCookedAt))
    : null;
  return (
    <Link
      href={`/meal/${meal.mealId}` as Route}
      className="group grid gap-3 rounded-[14px] border bg-[var(--surface)] p-3 transition-colors hover:border-[var(--border-strong,#cfccc0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Open recipe for ${meal.mealName}`}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {meal.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meal.photoUrl}
          alt=""
          className="aspect-[4/3] w-full rounded-md border bg-muted object-cover"
        />
      ) : (
        <MealTile name={meal.mealName} size="m" className="aspect-[4/3] w-full border" />
      )}
      <div className="grid gap-1">
        <span className="truncate text-[14px] font-medium text-foreground group-hover:underline">
          {meal.mealName}
        </span>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="sage" className="font-mono">
            {meal.cookCount}× cooked
          </Badge>
          <span
            className="font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.12em" }}
          >
            {days !== null
              ? days === 0
                ? "today"
                : `${days}d ago`
              : "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ResurfaceRow({
  suggestion,
  isLast
}: {
  suggestion: RediscoverySuggestion;
  isLast: boolean;
}) {
  return (
    <Link
      href={`/meal/${suggestion.mealId}` as Route}
      className={cn(
        "grid cursor-pointer grid-cols-[44px_1fr_auto] items-center gap-3 px-[18px] py-3 transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isLast ? "" : "border-b"
      )}
      aria-label={`Open recipe for ${suggestion.mealName}`}
    >
      {suggestion.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={suggestion.photoUrl}
          alt=""
          className="aspect-square w-11 rounded-md border bg-muted object-cover"
        />
      ) : (
        <MealTile name={suggestion.mealName} size="s" className="aspect-square w-11 border" />
      )}
      <div className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-foreground">
          {suggestion.mealName}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {suggestion.description}
        </span>
      </div>
      {/* Decorative "Cook tonight" chip — no click handler for v1
          per the R26 spec. The whole row navigates to the recipe;
          the chip is a visual nudge. */}
      <Badge variant="sage" className="font-mono">
        Cook tonight
      </Badge>
    </Link>
  );
}

function UpcomingPlanCard({
  plan
}: {
  plan: {
    id: string;
    name: string;
    scheduledDate: string | null;
    dishCount: number;
  } | null;
}) {
  if (!plan) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-[14px] border bg-[var(--surface)] px-[18px] py-6 text-center"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[color:var(--sage-soft)] text-[color:var(--sage-fg)]">
          <Calendar className="h-5 w-5" />
        </span>
        <p className="max-w-[240px] text-[13.5px] leading-[1.5] text-muted-foreground">
          No plans scheduled. Sketch out the week to start cooking with intent.
        </p>
        <Button asChild variant="default" className="min-h-[40px]">
          <Link href={"/plans/new" as Route}>
            <Plus className="h-3.5 w-3.5" />
            New plan
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div
      className="grid gap-3 overflow-hidden rounded-[14px] border bg-[var(--surface)]"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <header className="bg-[color:var(--sage-soft)] px-[18px] py-3">
        <SectionLabel
          action={
            <Link
              href={"/plans" as Route}
              className="text-[11.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              All plans →
            </Link>
          }
        >
          Upcoming plan
        </SectionLabel>
      </header>
      <div className="grid gap-2 px-[18px] pb-[18px]">
        <Link
          href={`/plans/${plan.id}` as Route}
          className="font-serif text-[22px] leading-tight text-foreground underline-offset-2 hover:underline"
          style={{ letterSpacing: "-0.01em" }}
        >
          {plan.name}
        </Link>
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.14em" }}>
          <Calendar className="h-3 w-3" />
          {plan.scheduledDate
            ? format(parseISO(plan.scheduledDate), "EEE, MMM d")
            : "Unscheduled"}
          <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
          <span>
            {plan.dishCount === 0
              ? "No dishes yet"
              : `${plan.dishCount} dish${plan.dishCount === 1 ? "" : "es"}`}
          </span>
        </div>
        <Button asChild variant="outline" className="mt-2 min-h-[40px]">
          <Link href={`/plans/${plan.id}` as Route}>
            <Sparkles className="h-3.5 w-3.5" />
            Open plan
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyTile({ label }: { label: string }) {
  return (
    <div className="rounded-[14px] border border-dashed bg-[var(--surface-2)] p-6 text-center text-[13px] text-muted-foreground">
      {label}
    </div>
  );
}

