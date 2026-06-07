"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Lock, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import { MealImage } from "@/components/mobile/meal-image";
import { EffortPill } from "@/components/history/effort-pill";
import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";
import type { EffortLevel } from "@/types";

type PlanDish = {
  id: string;
  mealId: string;
  mealName: string;
  mealPhotoUrl: string | null;
  actualEffort: EffortLevel | null;
  annotationNotes: string | null;
  addedByName: string | null;
  locked: boolean;
};

/**
 * R35 mobile-web Plan detail. Renders below `md`; the desktop
 * `<PlanDetailClient>` renders `hidden md:block` alongside off the same props.
 * Read-focused: menu rows link to each recipe (locked co-cook rows stay
 * inert), a wheat note callout, and a collapsible shopping list built from the
 * server-aggregated ingredient names. Editing stays on the desktop client.
 */
export function PlanDetailMobile({
  plan,
  ownerName,
  dishes,
  hiddenDishCount,
  shoppingList
}: {
  plan: { id: string; name: string; scheduledDate: string; notes: string | null };
  ownerName: string | null;
  dishes: PlanDish[];
  hiddenDishCount: number;
  shoppingList: string[];
}) {
  const [showList, setShowList] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<number>>(() => new Set());

  const dateLabel = new Date(`${plan.scheduledDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  });

  return (
    <MobileScaffold>
      <MobileTopBar back title={plan.name} sub={dateLabel} />

      <div className="px-4 pt-3">
        <div className="rounded-[18px] border border-border bg-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">{dateLabel}</div>
          <h1 className="mt-1.5 font-serif text-[28px] leading-tight tracking-[-0.02em] text-foreground">{plan.name}</h1>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
            {dishes.length} dish{dishes.length === 1 ? "" : "es"}
            {ownerName ? ` · by ${ownerName}` : ""}
          </p>
        </div>
      </div>

      {plan.notes && (
        <div className="px-4 pt-3">
          <div className="rounded-[14px] border border-[color:var(--wheat,#d9c68c)] bg-[color:var(--warn-soft)] p-3.5">
            <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[color:var(--warn,#8a6a1c)]">
              Note
            </div>
            <p className="text-[13.5px] leading-snug text-foreground">{plan.notes}</p>
          </div>
        </div>
      )}

      <section className="px-4 pt-5">
        <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">The menu</h2>
        <div className="grid gap-2.5">
          {dishes.map((d) =>
            d.locked ? (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-[16px] border border-border bg-[color:var(--surface-2)] p-3 opacity-80"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card text-[color:var(--ink4)]">
                  <Lock className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-muted-foreground">A private dish</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
                    {d.addedByName ? `Added by ${d.addedByName}` : "Not shared with you"}
                  </span>
                </span>
              </div>
            ) : (
              <Link
                key={d.id}
                href={`/meal/${d.mealId}` as Route}
                className="flex items-center gap-3 rounded-[16px] border border-border bg-card p-3 active:bg-[color:var(--surface-2)]"
              >
                <MealImage name={d.mealName} photoUrl={d.mealPhotoUrl} size="s" className="h-12 w-12 shrink-0 rounded-[12px] border" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {d.mealName}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    {d.actualEffort && <EffortPill level={d.actualEffort} compact />}
                    {d.annotationNotes && (
                      <span className="truncate text-[11.5px] text-muted-foreground">{d.annotationNotes}</span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink4)]" />
              </Link>
            )
          )}
        </div>
        {hiddenDishCount > 0 && (
          <p className="mt-2.5 text-center text-[12px] text-[color:var(--ink3)]">
            {hiddenDishCount} more dish{hiddenDishCount === 1 ? "" : "es"} not shared with you
          </p>
        )}
      </section>

      {shoppingList.length > 0 && (
        <section className="px-4 pb-4 pt-5">
          <button
            type="button"
            onClick={() => setShowList((s) => !s)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[14px] font-semibold text-primary-foreground active:scale-[0.99]"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {showList ? "Hide shopping list" : "Build the shopping list"}
          </button>
          {showList && (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
              {shoppingList.map((item, i) => {
                const isChecked = checked.has(i);
                return (
                  <li key={`${item}-${i}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-[color:var(--surface-2)]"
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-[color:var(--ink4)]"
                        )}
                      >
                        {isChecked && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={cn("text-[14.5px]", isChecked ? "text-[color:var(--ink3)] line-through" : "text-foreground")}>
                        {item}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </MobileScaffold>
  );
}
