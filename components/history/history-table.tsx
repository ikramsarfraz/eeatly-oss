"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EffortPill } from "@/components/history/effort-pill";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { MealThumb } from "@/components/dashboard/meal-thumb";
import { cn } from "@/lib/utils";
import type { HistoryRow, HistorySortDir, HistorySortField } from "@/services/meals";

type HistoryTableProps = {
  rows: HistoryRow[];
  sort: HistorySortField;
  dir: HistorySortDir;
  onSort: (field: HistorySortField) => void;
};

export function HistoryTable({ rows, sort, dir, onSort }: HistoryTableProps) {
  const groups = groupByMonth(rows);

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]">
      {/* Column header strip */}
      <div className="grid grid-cols-[44px_minmax(220px,2fr)_140px_120px_minmax(220px,2.2fr)_150px] gap-3 border-b border-border bg-[var(--surface-2)] px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span />
        <SortHeader field="name" current={sort} dir={dir} onSort={onSort}>
          Meal
        </SortHeader>
        <SortHeader field="date" current={sort} dir={dir} onSort={onSort}>
          Cooked
        </SortHeader>
        <span>Effort</span>
        <span>Notes</span>
        <span className="text-right">Actions</span>
      </div>

      {groups.map(({ key, label, items }) => (
        <section key={key}>
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <h2 className="font-serif text-[18px] leading-none">{label}</h2>
            <span className="rounded-[5px] bg-[var(--surface-2)] px-[7px] py-px font-mono-brand text-[11px] text-muted-foreground">
              {items.length}
            </span>
            <span className="ml-1 h-px flex-1 border-t border-dashed border-border" />
          </div>
          {items.map((row, idx) => (
            <div
              key={row.id}
              className="grid grid-cols-[44px_minmax(220px,2fr)_140px_120px_minmax(220px,2.2fr)_150px] items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-[var(--surface-2)]"
            >
              <MealThumb
                photoUrl={row.photoUrl}
                mealName={row.mealName}
                fallbackIndex={idx}
              />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-foreground">
                  {row.mealName}
                </div>
              </div>
              <div className="text-[12.5px]">
                <div className="font-mono-brand text-foreground">
                  {format(parseISO(row.cookedAt), "MMM d, yyyy")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(parseISO(row.cookedAt), { addSuffix: true })}
                </div>
              </div>
              <div>
                <EffortPill level={row.effortLevel} />
              </div>
              <div className="line-clamp-2 text-[12.5px] text-muted-foreground">
                {row.notes ?? <span className="text-[var(--subtle-fg)]">—</span>}
              </div>
              <div className="flex items-center justify-end gap-2">
                <LogAgainButton
                  mealName={row.mealName}
                  effortLevel={row.effortLevel}
                  variant="outline"
                  compact
                />
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function SortHeader({
  field,
  current,
  dir,
  onSort,
  children
}: {
  field: HistorySortField;
  current: HistorySortField;
  dir: HistorySortDir;
  onSort: (field: HistorySortField) => void;
  children: React.ReactNode;
}) {
  const active = field === current;
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";

  // aria-sort lives on the column-header element, not the inner button — the
  // button is the activator. Wrapping in a span with role="columnheader"
  // keeps both pieces happy without giving up the button semantics.
  return (
    <span role="columnheader" aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 text-left uppercase tracking-[0.08em] transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {children}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </span>
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
