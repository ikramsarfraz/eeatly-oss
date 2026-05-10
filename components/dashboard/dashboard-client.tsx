"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertCircle, BookOpen, Loader2 } from "lucide-react";
import { MealLogForm } from "@/components/forms/meal-log-form";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { RediscoverySuggestions } from "@/components/dashboard/rediscovery-suggestions";
import { RecentHistoryList } from "@/components/dashboard/recent-history-list";
import { MealStatsList } from "@/components/dashboard/meal-stats-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardMeals } from "@/hooks/use-dashboard-meals";
import type { DashboardMeals } from "@/types";

export function DashboardClient({
  initialData,
  canWrite
}: {
  initialData: DashboardMeals;
  canWrite: boolean;
}) {
  const { data, error, isError, isFetching } = useDashboardMeals(initialData);
  const meals = data ?? initialData;
  const topSuggestion = meals.suggestions[0];
  const hasMeals = meals.recentMeals.length > 0;
  const totalRecentLogs = meals.recentMeals.length;
  const repeatMeals = meals.mostCookedMeals.filter((meal) => meal.cookCount > 1).length;
  const recentLog = meals.recentMeals[0];
  const daysSinceLastCook = recentLog?.cookedAt
    ? differenceInCalendarDays(new Date(), parseISO(recentLog.cookedAt))
    : null;

  return (
    <div className="grid gap-4 pb-20 md:gap-5 md:pb-0">
      {isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : "Unable to load your meal history."}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr] lg:gap-5">
        <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Tonight</p>
              {isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              What should I cook tonight?
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              {topSuggestion
                ? `${topSuggestion.mealName} is worth considering. ${topSuggestion.description}`
                : "CookLoop gets useful after a few quick logs. Add what you cooked, then come back here when you need an easy answer."}
            </p>
            {hasMeals && typeof daysSinceLastCook === "number" ? (
              <p className="mt-3 text-sm text-primary/85">
                {daysSinceLastCook === 0
                  ? "You already logged today—want to scroll ideas or log another dinner?"
                  : daysSinceLastCook === 1
                    ? "Welcome back. Your newest log was yesterday."
                    : `Welcome back. Your newest log was ${daysSinceLastCook} days ago.`}
              </p>
            ) : null}
          </div>
          {hasMeals ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Recent logs</p>
                <p className="mt-1 text-2xl font-semibold">{totalRecentLogs}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Reliable repeats</p>
                <p className="mt-1 text-2xl font-semibold">{repeatMeals}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Ideas ready</p>
                <p className="mt-1 text-2xl font-semibold">{meals.suggestions.length}</p>
              </div>
            </div>
          ) : null}
          {!hasMeals ? (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-xl border border-dashed bg-background/70 p-4 text-sm text-muted-foreground sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="grid gap-1">
                  <p className="font-medium text-foreground">Start with one meal.</p>
                  <p>
                    Log something you cooked recently. CookLoop will turn those quick notes
                    into recent history, most-cooked meals, and rediscovery ideas.
                  </p>
                </div>
              </div>
              <OnboardingCard />
            </div>
          ) : null}
          <RediscoverySuggestions suggestions={meals.suggestions} />
        </div>

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader>
            <CardTitle>Quick log</CardTitle>
          </CardHeader>
          <CardContent>
            <MealLogForm canWrite={canWrite} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <RecentHistoryList meals={meals.recentMeals} />
        <MealStatsList title="Most cooked" meals={meals.mostCookedMeals} />
        <MealStatsList title="Not cooked recently" meals={meals.neglectedMeals} />
      </section>
    </div>
  );
}
