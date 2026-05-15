"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArchiveRestore, CalendarDays, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClonePlanDialog } from "@/components/plans/clone-plan-dialog";

type PlanListItem = {
  id: string;
  name: string;
  scheduledDate: string;
  archivedAt: Date | null;
  dishCount: number;
};

type PlansListProps = {
  plans: PlanListItem[];
  showingArchived: boolean;
};

export function PlansList({ plans, showingArchived }: PlansListProps) {
  const [cloneSource, setCloneSource] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggleArchived(next: boolean) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("archived", "1");
    else sp.delete("archived");
    router.push(`/plans${sp.toString() ? `?${sp.toString()}` : ""}` as Route);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-normal">Plans</h1>
        <Button asChild>
          <Link href={"/plans/new" as Route}>New plan</Link>
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {plans.length === 0
            ? showingArchived
              ? "No archived plans."
              : "No plans yet — create one for your next occasion."
            : `${plans.length} ${plans.length === 1 ? "plan" : "plans"}`}
        </span>
        <button
          type="button"
          onClick={() => toggleArchived(!showingArchived)}
          className="text-xs underline-offset-2 hover:underline"
        >
          {showingArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>

      {plans.length > 0 ? (
        <ul className="grid gap-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <article className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/60 p-4 transition-colors hover:bg-[var(--surface-2)]">
                <Link
                  href={`/plans/${plan.id}` as Route}
                  className="flex min-w-0 flex-1 items-start gap-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-muted-foreground">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{plan.name}</span>
                      {plan.archivedAt ? (
                        <Badge variant="secondary" className="text-xs">
                          Archived
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {format(parseISO(plan.scheduledDate), "EEE, MMM d, yyyy")} ·{" "}
                      {plan.dishCount} {plan.dishCount === 1 ? "dish" : "dishes"}
                    </span>
                  </span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCloneSource({ id: plan.id, name: plan.name })}
                  aria-label={`Clone ${plan.name}`}
                >
                  <Copy className="h-4 w-4" />
                  Clone
                </Button>
              </article>
            </li>
          ))}
        </ul>
      ) : null}

      {plans.length === 0 && !showingArchived ? (
        <div className="rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Why use plans?</p>
          <p className="mt-1">
            Pick dishes for a birthday, Eid, or weeknight ahead of time. After
            the meal, jot notes so next time&apos;s plan starts smarter.
          </p>
        </div>
      ) : null}

      {plans.length === 0 && showingArchived ? (
        <div className="grid gap-3 rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
          <p>You haven&apos;t archived any plans yet.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => toggleArchived(false)}
            className="w-fit"
          >
            <ArchiveRestore className="h-4 w-4" />
            Back to active plans
          </Button>
        </div>
      ) : null}

      {cloneSource ? (
        <ClonePlanDialog
          open={Boolean(cloneSource)}
          onOpenChange={(open) => {
            if (!open) setCloneSource(null);
          }}
          source={cloneSource}
        />
      ) : null}
    </div>
  );
}
