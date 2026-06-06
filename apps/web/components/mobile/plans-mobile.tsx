"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";

export type PlanListItem = {
  id: string;
  name: string;
  scheduledDate: string;
  archivedAt: Date | string | null;
  dishCount: number;
};

function dateParts(scheduledDate: string): { mon: string; day: string } {
  const d = new Date(`${scheduledDate}T00:00:00`);
  return {
    mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate())
  };
}

/**
 * R35 mobile-web Plans list. Renders below `md`; the desktop `<PlansClient>`
 * renders `hidden md:block` alongside off the same `plans` prop. Splits into
 * Upcoming / Past / Drafts (archived) the way the desktop client does.
 */
export function PlansMobile({ plans }: { plans: PlanListItem[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = plans.filter((p) => !p.archivedAt);
  const upcoming = active
    .filter((p) => p.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const past = active
    .filter((p) => p.scheduledDate < today)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const drafts = plans.filter((p) => p.archivedAt);

  return (
    <MobileScaffold>
      <MobileTopBar
        big
        eyebrow="Occasions"
        title="Plans."
        right={
          <Link
            href="/plans/new"
            aria-label="New plan"
            className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </Link>
        }
      />

      {plans.length === 0 ? (
        <div className="px-4 pt-10 text-center">
          <p className="text-[15px] font-medium text-foreground">No plans yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Build a menu for a day worth cooking for.</p>
          <Link
            href="/plans/new"
            className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-5 text-[14px] font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New plan
          </Link>
        </div>
      ) : (
        <div className="pt-2">
          <PlanSection label="Upcoming" plans={upcoming} />
          <PlanSection label="Past" plans={past} muted />
          <PlanSection label="Drafts & ideas" plans={drafts} muted />
        </div>
      )}
    </MobileScaffold>
  );
}

function PlanSection({ label, plans, muted }: { label: string; plans: PlanListItem[]; muted?: boolean }) {
  if (plans.length === 0) return null;
  return (
    <section className="px-4 pb-1 pt-4">
      <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">{label}</h2>
      <div className="grid gap-2.5">
        {plans.map((p) => {
          const { mon, day } = dateParts(p.scheduledDate);
          return (
            <Link
              key={p.id}
              href={`/plans/${p.id}`}
              className="flex items-center gap-[14px] rounded-[16px] border border-border bg-card p-3 active:bg-[color:var(--surface-2)]"
            >
              <span
                className={`flex h-[50px] w-[50px] shrink-0 flex-col items-center justify-center rounded-[12px] ${
                  muted ? "bg-[color:var(--surface-2)] text-muted-foreground" : "bg-secondary text-primary"
                }`}
              >
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] leading-none">{mon}</span>
                <span className="font-serif text-[21px] leading-tight">{day}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[17px] tracking-[-0.01em] text-foreground">{p.name}</span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
                  {p.dishCount} dish{p.dishCount === 1 ? "" : "es"}
                  {p.archivedAt ? " · draft" : ""}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink4)]" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
