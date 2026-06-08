"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { formatCookedDay } from "@/lib/dates";
import { useDashboardMeals } from "@/hooks/use-dashboard-meals";
import { MealImage } from "@/components/mobile/meal-image";
import { EffortPill } from "@/components/history/effort-pill";
import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";
import { MobileAppBar } from "@/components/mobile/mobile-app-bar";
import type { DashboardMeals, EffortLevel } from "@/types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  if (h < 21) return "Good evening,";
  return "Good night,";
}

function firstName(name: string | null): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] ?? "there";
}

function withinWeek(iso: string): boolean {
  const then = new Date(iso).getTime();
  return Date.now() - then <= 7 * 24 * 60 * 60 * 1000;
}

/** "JUN 12" style date tile parts for the upcoming-plan card. */
function planDateParts(scheduledDate: string): { mon: string; day: string } {
  const d = new Date(`${scheduledDate}T00:00:00`);
  return {
    mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate())
  };
}

/**
 * R35 mobile-web Home. Renders below `md`; the desktop `<HomeClient>` renders
 * `hidden md:block` alongside. Reuses the same server-fetched `DashboardMeals`
 * and the same `plans.list` client query the desktop card uses.
 */
export function HomeMobile({
  initialData,
  currentUserName,
  householdName
}: {
  initialData: DashboardMeals;
  currentUserName: string | null;
  householdName: string;
}) {
  const { data } = useDashboardMeals(initialData);
  const meals = data ?? initialData;

  const [hello] = React.useState(greeting);

  const plansQuery = trpc.plans.list.useQuery(undefined, {
    staleTime: 60_000
  });
  const upcoming = React.useMemo(() => {
    const list = plansQuery.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const future = list
      .filter((p) => p.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    return future[0] ?? null;
  }, [plansQuery.data]);

  const loggedThisWeek = meals.recentMeals.filter((m) => withinWeek(m.cookedAt)).length;
  const plansCount = (plansQuery.data ?? []).filter(
    (p) => p.scheduledDate >= new Date().toISOString().slice(0, 10)
  ).length;

  // Cook tonight: a rediscovery suggestion if we have one, else the most-cooked.
  const heroSuggestion = meals.suggestions[0] ?? null;
  const heroStat = meals.mostCookedMeals[0] ?? null;
  const hero = heroSuggestion
    ? {
        mealId: heroSuggestion.mealId,
        name: heroSuggestion.mealName,
        photoUrl: heroSuggestion.photoUrl,
        effort: heroSuggestion.effortLevel,
        meta: heroSuggestion.title
      }
    : heroStat
      ? {
          mealId: heroStat.mealId,
          name: heroStat.mealName,
          photoUrl: heroStat.photoUrl,
          effort: null as EffortLevel | null,
          meta: `Cooked ${heroStat.cookCount}${heroStat.cookCount === 1 ? " time" : " times"}`
        }
      : null;

  // Jump back in: recent cooks (dedup by meal), fall back to most-cooked.
  const seen = new Set<string>();
  const jumpBack = [
    ...meals.recentMeals.map((m) => ({ mealId: m.mealId, name: m.mealName, photoUrl: m.photoUrl, date: m.cookedAt as string | null })),
    ...meals.mostCookedMeals.map((m) => ({ mealId: m.mealId, name: m.mealName, photoUrl: m.photoUrl, date: m.lastCookedAt as string | null }))
  ]
    .filter((m) => {
      if (seen.has(m.mealId)) return false;
      seen.add(m.mealId);
      return true;
    })
    .slice(0, 8);

  const summary =
    `${plansCount === 0 ? "No" : plansCount} plan${plansCount === 1 ? "" : "s"} coming up, ` +
    `and ${loggedThisWeek} meal${loggedThisWeek === 1 ? "" : "s"} logged this week.`;

  return (
    <MobileScaffold>
      <MobileAppBar title="Home" />
      <MobileTopBar
        big
        eyebrow={householdName.toUpperCase()}
        title={`${hello} ${firstName(currentUserName)}.`}
      />

      <p className="px-4 pb-1 pt-[6px] text-[14px] leading-snug text-muted-foreground">{summary}</p>

      {/* Cook tonight */}
      {hero && (
        <section className="px-4 pt-5">
          <SectionLabel>Cook tonight</SectionLabel>
          <div className="rounded-[18px] border border-border bg-card p-4 shadow-[0_1px_0_rgba(20,20,15,0.03)]">
            <div className="flex gap-[14px]">
              <MealImage name={hero.name} photoUrl={hero.photoUrl} size="m" className="aspect-square w-[68px] shrink-0 rounded-[14px] border" />
              <div className="min-w-0 flex-1 pt-[2px]">
                <h3 className="truncate font-serif text-[21px] leading-tight tracking-[-0.01em] text-foreground">
                  {hero.name}
                </h3>
                <div className="mt-1.5 flex items-center gap-2">
                  {hero.effort && <EffortPill level={hero.effort} />}
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
                    {hero.meta}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Link
                href={`/meal/${hero.mealId}`}
                className="flex h-11 items-center justify-center rounded-[12px] bg-primary text-[14px] font-semibold text-primary-foreground active:scale-[0.99]"
              >
                Start cooking
              </Link>
              <Link
                href={`/meal/${hero.mealId}`}
                className="flex h-11 items-center justify-center rounded-[12px] border border-border bg-card text-[14px] font-semibold text-foreground active:scale-[0.99]"
              >
                Recipe
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Jump back in */}
      {jumpBack.length > 0 && (
        <section className="pt-6">
          <div className="flex items-center justify-between px-4">
            <SectionLabel>Jump back in</SectionLabel>
            <Link href="/library" className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
              All recipes
            </Link>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {jumpBack.map((m) => (
              <Link key={m.mealId} href={`/meal/${m.mealId}`} className="w-[120px] shrink-0 snap-start">
                <MealImage name={m.name} photoUrl={m.photoUrl} size="m" className="aspect-square w-full rounded-[14px] border" />
                <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-tight text-foreground">{m.name}</p>
                {m.date && (
                  <span className="mt-1 inline-block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
                    {formatCookedDay(m.date)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Coming up */}
      <section className="px-4 pb-2 pt-6">
        <div className="flex items-center justify-between">
          <SectionLabel>Coming up</SectionLabel>
          <Link href="/plans" className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
            All plans
          </Link>
        </div>
        {upcoming ? (
          <Link
            href={`/plans/${upcoming.id}`}
            className="flex items-center gap-[14px] rounded-[18px] border border-border bg-card p-3.5 active:bg-[color:var(--surface-2)]"
          >
            <span className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[13px] bg-secondary text-primary">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] leading-none">
                {planDateParts(upcoming.scheduledDate).mon}
              </span>
              <span className="font-serif text-[22px] leading-tight">{planDateParts(upcoming.scheduledDate).day}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-[18px] tracking-[-0.01em] text-foreground">
                {upcoming.name}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
                {upcoming.dishCount} dish{upcoming.dishCount === 1 ? "" : "es"}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink4)]" />
          </Link>
        ) : (
          <Link
            href="/plans/new"
            className="flex items-center justify-center rounded-[18px] border border-dashed border-border bg-card/50 px-4 py-6 text-[14px] font-medium text-muted-foreground"
          >
            Plan an occasion +
          </Link>
        )}
      </section>
    </MobileScaffold>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">{children}</h2>
  );
}
