"use client";

import Link from "next/link";
import type { Route } from "next";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { EffortPill } from "@/components/history/effort-pill";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { MealThumb } from "@/components/dashboard/meal-thumb";
import { attributionLabel } from "@/lib/meals/attribution";
import type { HistoryRow } from "@/services/meals";

export function HistoryRows({
  rows,
  currentUserId
}: {
  rows: HistoryRow[];
  currentUserId: string;
}) {
  const groups = groupByMonth(rows);

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]">
      {groups.map(({ key, label, items }, groupIdx) => (
        <section key={key}>
          <div
            className={`flex items-center gap-2 px-4 py-3 ${groupIdx > 0 ? "border-t border-border" : ""}`}
          >
            <h2 className="font-serif text-[18px] leading-none">{label}</h2>
            <span className="rounded-[5px] bg-[var(--surface-2)] px-[7px] py-px font-mono-brand text-[11px] text-muted-foreground">
              {items.length}
            </span>
            <span className="ml-1 h-px flex-1 border-t border-dashed border-border" />
          </div>
          <div>
            {items.map((row, idx) => (
              <div
                key={row.id}
                className="grid grid-cols-[44px_1fr_130px_130px] items-center gap-3 border-t border-border px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <MealThumb
                  photoUrl={row.photoUrl}
                  mealName={row.mealName}
                  fallbackIndex={idx}
                />
                <div className="min-w-0">
                  <Link
                    href={`/meal/${row.mealId}` as Route}
                    className="block truncate text-[14px] font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {row.mealName}
                  </Link>
                  {(() => {
                    const a = attributionLabel(row.cookedByUserId, row.cookedByName, currentUserId);
                    return a ? (
                      <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{a}</div>
                    ) : null;
                  })()}
                  {row.notes ? (
                    <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {row.notes}
                    </div>
                  ) : null}
                </div>
                <div className="text-[12.5px] text-foreground">
                  <div className="font-mono-brand">
                    {format(parseISO(row.cookedAt), "MMM d")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(row.cookedAt), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <EffortPill level={row.effortLevel} compact />
                  <LogAgainButton
                    mealName={row.mealName}
                    effortLevel={row.effortLevel}
                    variant="ghost"
                    compact
                    iconOnly
                  />
                </div>
              </div>
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
