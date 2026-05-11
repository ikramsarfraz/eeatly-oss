"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertCircle, BookOpen, Check, Loader2, TrendingUp } from "lucide-react";
import { MealLogForm } from "@/components/forms/meal-log-form";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { RediscoverySuggestions } from "@/components/dashboard/rediscovery-suggestions";
import { RecentHistoryList } from "@/components/dashboard/recent-history-list";
import { MealStatsList } from "@/components/dashboard/meal-stats-list";
import { useDashboardMeals } from "@/hooks/use-dashboard-meals";
import type { DashboardMeals } from "@/types";

export function DashboardClient({
  initialData,
  canWrite
}: {
  initialData: DashboardMeals;
  canWrite: boolean;
}) {
  const { data, isError, isFetching } = useDashboardMeals(initialData);
  const meals = data ?? initialData;
  const topSuggestion = meals.suggestions[0];
  const hasMeals = meals.recentMeals.length > 0;
  const totalRecentLogs = meals.recentMeals.length;
  const repeatMeals = meals.mostCookedMeals.filter((meal) => meal.cookCount > 1).length;
  const recentLog = meals.recentMeals[0];
  const daysSinceLastCook = recentLog?.cookedAt
    ? differenceInCalendarDays(new Date(), parseISO(recentLog.cookedAt))
    : null;

  const timeLabel = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  return (
    <div className="grid gap-5">
      {isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          We couldn&apos;t load your meals right now. Please try again in a moment.
        </div>
      ) : null}

      {/* Hero + Quick log */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Hero card */}
        <div
          className="relative overflow-hidden rounded-[20px] border bg-[var(--surface)] p-7 sm:p-8"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          {/* Decorative radial */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[60px] -top-[60px] h-[280px] w-[280px] rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(circle, var(--accent-soft) 0%, transparent 65%)"
            }}
          />

          {/* Eyebrow pill */}
          <span className="relative mb-[18px] inline-flex items-center gap-[7px] rounded-full bg-[var(--primary-soft)] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Tonight · {timeLabel}
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
          </span>

          {/* Serif headline */}
          <h1 className="relative mb-[14px] max-w-[520px] font-serif text-[46px] font-normal leading-[1.12] tracking-[-0.015em] max-[820px]:text-[36px]">
            What should I cook <em className="italic text-primary">tonight?</em>
          </h1>

          <p className="relative mb-[22px] max-w-[480px] text-[15px] leading-[1.55] text-[var(--muted-foreground)]">
            {topSuggestion
              ? `${topSuggestion.mealName} is worth considering — ${topSuggestion.description}`
              : "eeatly gets useful after a few quick logs. Add what you cooked, then come back here when you need an easy answer."}
          </p>

          {/* CTAs */}
          {hasMeals && topSuggestion ? (
            <div className="relative flex flex-wrap gap-[10px]">
              <button type="button" className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-[14px] py-[10px] text-[13.5px] font-medium text-primary-foreground transition-colors hover:bg-[#265a48]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Cook this tonight
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-[8px] px-[10px] py-[7px] text-[13px] text-foreground hover:bg-[var(--surface-2)]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                Show more ideas
              </button>
            </div>
          ) : null}

          {/* Stats */}
          {hasMeals ? (
            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-[var(--border-strong,#cfccc0)] pt-[22px] max-[480px]:grid-cols-1 max-[480px]:gap-2 max-[480px]:pt-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  Recent logs
                </div>
                <div className="mt-1.5 font-serif text-[32px] leading-none tracking-[-0.01em] max-[820px]:text-[24px] max-[480px]:text-[20px]">
                  {totalRecentLogs}
                </div>
                <div className="mt-1 text-[11px] text-primary">meals logged</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  Reliable repeats
                </div>
                <div className="mt-1.5 font-serif text-[32px] leading-none tracking-[-0.01em] max-[820px]:text-[24px] max-[480px]:text-[20px]">
                  {repeatMeals}
                </div>
                <div className="mt-1 text-[11px] text-primary">
                  {hasMeals && typeof daysSinceLastCook === "number" && daysSinceLastCook === 0
                    ? "logged today"
                    : typeof daysSinceLastCook === "number"
                      ? `last ${daysSinceLastCook}d ago`
                      : "across logs"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  Ideas ready
                </div>
                <div className="mt-1.5 font-serif text-[32px] leading-none tracking-[-0.01em] max-[820px]:text-[24px] max-[480px]:text-[20px]">
                  {meals.suggestions.length}
                </div>
                <div className="mt-1 text-[11px] text-primary">fresh tonight</div>
              </div>
            </div>
          ) : null}

          {/* No-meals onboarding */}
          {!hasMeals ? (
            <div className="relative mt-4 grid gap-4">
              <div className="grid gap-3 rounded-xl border border-dashed bg-background/70 p-4 text-sm text-muted-foreground sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="grid gap-1">
                  <p className="font-medium text-foreground">Start with one meal.</p>
                  <p>
                    Log something you cooked recently. eeatly will turn those quick notes
                    into recent history, most-cooked meals, and rediscovery ideas.
                  </p>
                </div>
              </div>
              <OnboardingCard />
            </div>
          ) : null}
        </div>

        {/* Quick log card */}
        <div
          className="flex flex-col gap-3 rounded-[20px] border bg-[var(--surface)] p-[22px] pb-[18px] lg:sticky lg:top-[76px] lg:self-start"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                style={{ boxShadow: "0 0 0 4px var(--primary-soft)" }}
              />
              Quick log
            </span>
            <span className="font-mono-brand text-[11px] text-[var(--muted-foreground)]">
              ⌘ + Enter
            </span>
          </div>
          <MealLogForm canWrite={canWrite} />
        </div>
      </section>

      {/* Rediscovery suggestions */}
      {hasMeals && meals.suggestions.length > 0 ? (
        <section>
          <div className="mb-[14px] mt-1 flex items-baseline justify-between">
            <h2 className="font-serif text-[26px] font-normal tracking-[-0.005em]">
              Ideas <em className="italic text-[var(--muted-foreground)]">for tonight</em>
            </h2>
            <div className="flex items-center gap-3 text-[12px] text-[var(--muted-foreground)]">
              <span>{meals.suggestions.length} ideas</span>
            </div>
          </div>
          <RediscoverySuggestions suggestions={meals.suggestions} />
        </section>
      ) : null}

      {/* Three panels */}
      <section>
        <div className="mb-[14px] mt-1 flex items-baseline justify-between">
          <h2 className="font-serif text-[26px] font-normal tracking-[-0.005em]">
            Your <em className="italic text-[var(--muted-foreground)]">kitchen</em>
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <RecentHistoryList meals={meals.recentMeals} />
          <MealStatsList title="Most cooked" meals={meals.mostCookedMeals} />
          <MealStatsList title="Not cooked recently" meals={meals.neglectedMeals} />
        </div>
      </section>
    </div>
  );
}
