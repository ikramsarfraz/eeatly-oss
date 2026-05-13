"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { EffortPill } from "@/components/history/effort-pill";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { MealThumb } from "@/components/dashboard/meal-thumb";
import type { HistoryRow } from "@/services/meals";

export function HistoryCards({ rows }: { rows: HistoryRow[] }) {
  const groups = groupByMonth(rows);

  return (
    <div className="grid gap-5">
      {groups.map(({ key, label, items }) => (
        <section key={key} className="grid gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-[18px] leading-none">{label}</h2>
            <span className="rounded-[5px] bg-[var(--surface-2)] px-[7px] py-px font-mono-brand text-[11px] text-muted-foreground">
              {items.length}
            </span>
            <span className="ml-1 h-px flex-1 border-t border-dashed border-border" />
          </div>
          <div className="grid gap-2.5">
            {items.map((row, idx) => (
              <article
                key={row.id}
                className="grid gap-2.5 rounded-[12px] border border-border bg-[var(--surface)] p-3"
              >
                <div className="flex items-start gap-3">
                  <MealThumb
                    photoUrl={row.photoUrl}
                    mealName={row.mealName}
                    fallbackIndex={idx}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[14px] font-medium text-foreground">
                      {row.mealName}
                    </h3>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {format(parseISO(row.cookedAt), "MMM d")} ·{" "}
                      {formatDistanceToNow(parseISO(row.cookedAt), { addSuffix: true })}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <EffortPill level={row.effortLevel} compact />
                    </div>
                  </div>
                </div>
                {row.notes ? (
                  <p className="line-clamp-2 text-[13px] leading-[1.45] text-muted-foreground">
                    {row.notes}
                  </p>
                ) : null}
                <LogAgainButton
                  mealName={row.mealName}
                  effortLevel={row.effortLevel}
                  variant="outline"
                  compact
                  className="w-full"
                />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupByMonth(rows: HistoryRow[]): { key: string; label: string; items: HistoryRow[] }[] {
  const map = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const d = parseISO(row.cookedAt);
    const key = format(d, "yyyy-MM");
    const existing = map.get(key);
    if (existing) existing.push(row);
    else map.set(key, [row]);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    label: format(parseISO(`${key}-01`), "MMMM yyyy"),
    items
  }));
}
