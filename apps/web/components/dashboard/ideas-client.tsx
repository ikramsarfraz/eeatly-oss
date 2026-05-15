"use client";

import Link from "next/link";
import { AlertCircle, BookOpen, Sparkles } from "lucide-react";
import { RediscoverySuggestions } from "@/components/dashboard/rediscovery-suggestions";
import { useDashboardMeals } from "@/hooks/use-dashboard-meals";
import type { DashboardMeals } from "@/types";

export function IdeasClient({ initialData }: { initialData: DashboardMeals }) {
  const { data, isError } = useDashboardMeals(initialData);
  const meals = data ?? initialData;
  const suggestions = meals.suggestions;
  const hasMeals = meals.recentMeals.length > 0;

  return (
    <div className="grid gap-6">
      {isError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          We couldn&apos;t load your ideas right now. Please try again in a moment.
        </div>
      ) : null}

      <header className="grid gap-3">
        <span className="inline-flex w-fit items-center gap-[7px] rounded-full bg-[var(--primary-soft)] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          <Sparkles className="h-3 w-3" />
          Rediscovery
        </span>
        <h1 className="font-serif text-[40px] font-normal leading-[1.12] tracking-[-0.015em] max-md:text-[30px]">
          Ideas <em className="italic text-primary">for tonight</em>
        </h1>
        <p className="max-w-[560px] text-[14.5px] leading-[1.55] text-muted-foreground">
          {suggestions.length > 0
            ? "Meals worth resurfacing — a mix of recent favorites, quick wins, and dishes you haven't cooked in a while."
            : "We resurface meals once you've logged a few. Quick logs make this page useful within a week."}
        </p>
      </header>

      {suggestions.length > 0 ? (
        <RediscoverySuggestions suggestions={suggestions} />
      ) : (
        <div className="grid gap-3 rounded-xl border border-dashed bg-background/70 p-5 text-sm text-muted-foreground sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="grid gap-1">
            <p className="font-medium text-foreground">
              {hasMeals ? "Keep logging — ideas appear here soon." : "Log your first meal."}
            </p>
            <p>
              {hasMeals
                ? "After a few more logs, eeatly will surface meals worth cooking again."
                : "Add what you cooked recently, then come back here when you need an easy answer."}
            </p>
            {!hasMeals ? (
              <Link
                href="/dashboard"
                className="mt-1 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
              >
                Go to Tonight →
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
