"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealTile } from "@/components/ui/meal-tile";
import { useSetTopBarActions } from "@/components/layout/top-bar-actions";
import { useQuickLog } from "@/components/dashboard/quick-log-provider";
import { cn } from "@/lib/utils";

/**
 * Round 28 — editorial Library.
 *
 * Repurposes the `/history` route from a per-cook-log surface to a
 * recipe-library surface, matching the design. The old History UI
 * was a tabular log viewer; the new one is a 4-up MealTile grid with
 * filter chips and an editorial hero.
 *
 * Data path:
 *   - Server fetches `listMealLibrary` (full household catalog) +
 *     `getDashboardMeals` (cook-stat overlays). The client builds a
 *     mealId → { cookCount, lastCookedAt, effort } map from the
 *     dashboard data and joins it onto the library rows. Stats are
 *     overlaid where available; otherwise a row shows just name +
 *     photo + "Not yet cooked".
 *
 * Filter chips (derivable from current data):
 *   - All — every library row
 *   - Recently cooked — rows with `lastCookedAt` within 30 days
 *   - Most cooked — rows with `cookCount >= 2`
 *   - Never cooked — rows with no stat overlay (no cook logs)
 *
 * Skipped chips (no per-meal effort modal available):
 *   - Quick — would need each meal's modal effort; dashboard rows
 *     only carry the most-recent-cook's effort, not a modal. Chip
 *     renders decoratively (no-op).
 *   - High effort — same constraint. Decorative chip.
 *
 * Sort dropdown: decorative for v1 — the underlying query returns
 * meals in alphabetical order; a real sort would need either a
 * client-side reshuffle or a server query option. Flagged.
 *
 * List/grid toggle: omitted entirely. The design draws a toggle but
 * the list variant isn't drawn; rendering a decorative toggle adds
 * UI weight for no payoff.
 *
 * "New recipe" TopBar action opens the existing QuickLogDialog —
 * the closest equivalent to "add a meal" today (no `/add` route
 * lives in the app).
 */

export type LibraryRow = {
  id: string;
  name: string;
  photoUrl: string | null;
};

export type LibraryStat = {
  mealId: string;
  cookCount: number;
  lastCookedAt: string | null;
  effortLevel: "quick" | "easy" | "medium" | "high_effort" | null;
};

type LibraryClientProps = {
  rows: LibraryRow[];
  /** Stat overlays keyed by mealId. Joined client-side. */
  stats: LibraryStat[];
};

type FilterKey =
  | "all"
  | "recent"
  | "most"
  | "quick"
  | "high"
  | "never";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  recent: "Recently cooked",
  most: "Most cooked",
  quick: "Quick",
  high: "High effort",
  never: "Never cooked"
};

const DERIVED_FILTERS: ReadonlyArray<FilterKey> = [
  "all",
  "recent",
  "most",
  "never"
];

const DECORATIVE_FILTERS: ReadonlyArray<FilterKey> = ["quick", "high"];

export function LibraryClient({ rows, stats }: LibraryClientProps) {
  const { open: openQuickLog } = useQuickLog();
  const [filter, setFilter] = React.useState<FilterKey>("all");

  // TopBar action: New recipe. Opens the existing QuickLogDialog
  // since `/add` doesn't exist. Memoised to keep the actions
  // provider's effect stable.
  const topBarAction = React.useMemo(
    () => (
      <Button
        variant="default"
        className="min-h-[40px]"
        onClick={openQuickLog}
      >
        <Plus className="h-3.5 w-3.5" />
        New recipe
      </Button>
    ),
    [openQuickLog]
  );
  useSetTopBarActions(topBarAction);

  // Stats map keyed by mealId.
  const statsByMealId = React.useMemo(() => {
    const map = new Map<string, LibraryStat>();
    for (const stat of stats) map.set(stat.mealId, stat);
    return map;
  }, [stats]);

  // Capture "now" once at mount so re-renders don't move the
  // 30-day window under the user's feet (and so the memo body stays
  // pure — Date.now() inside useMemo trips the react-hooks/purity
  // rule).
  const [now] = React.useState(() => Date.now());
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  // Derived counts for chip subtitles. Computed once per stats change.
  const counts = React.useMemo(() => {
    let recent = 0;
    let most = 0;
    let never = 0;
    for (const row of rows) {
      const stat = statsByMealId.get(row.id);
      if (!stat) {
        never += 1;
        continue;
      }
      if (stat.cookCount >= 2) most += 1;
      if (
        stat.lastCookedAt &&
        now - new Date(stat.lastCookedAt).getTime() <= thirtyDays
      ) {
        recent += 1;
      }
    }
    return {
      all: rows.length,
      recent,
      most,
      quick: 0,
      high: 0,
      never
    } as Record<FilterKey, number>;
  }, [rows, statsByMealId, now, thirtyDays]);

  // Apply filter to rows.
  const filteredRows = React.useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "quick" || filter === "high") {
      // Decorative chips — no filter applied. Equivalent to "All"
      // visually but with the chip styled active. Flagged.
      return rows;
    }
    return rows.filter((row) => {
      const stat = statsByMealId.get(row.id);
      if (filter === "never") return !stat;
      if (filter === "recent") {
        return Boolean(
          stat?.lastCookedAt &&
            now - new Date(stat.lastCookedAt).getTime() <= thirtyDays
        );
      }
      if (filter === "most") return (stat?.cookCount ?? 0) >= 2;
      return true;
    });
  }, [rows, statsByMealId, filter, now, thirtyDays]);

  return (
    <div className="grid gap-7">
      {/* Hero band — left: 64px display + description with count.
          Right slot: sort decoration. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1
            className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[64px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Library.
          </h1>
          <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
            Every meal cooked in your kitchen —{" "}
            <strong className="text-foreground">{rows.length}</strong>{" "}
            {rows.length === 1 ? "recipe" : "recipes"}.
          </p>
        </div>
        {/* Sort decoration — design draws a sort dropdown but the
            underlying query order is alphabetical; wiring a real sort
            requires a server option or a client reshuffle. Flagged. */}
        <span
          className="cursor-default rounded-full border bg-[var(--surface-2)] px-3 py-1.5 font-mono text-[10.5px] uppercase text-muted-foreground opacity-70"
          style={{ letterSpacing: "0.13em" }}
          aria-disabled
        >
          A–Z
        </span>
      </header>

      {/* Filter chip row */}
      <nav
        aria-label="Library filters"
        className="flex flex-wrap items-center gap-2"
      >
        {(DERIVED_FILTERS as ReadonlyArray<FilterKey>).map((key) => (
          <FilterChip
            key={key}
            active={filter === key}
            count={counts[key]}
            label={FILTER_LABELS[key]}
            onClick={() => setFilter(key)}
          />
        ))}
        {(DECORATIVE_FILTERS as ReadonlyArray<FilterKey>).map((key) => (
          <FilterChip
            key={key}
            active={filter === key}
            count={null}
            label={FILTER_LABELS[key]}
            decorative
            onClick={() => setFilter(key)}
          />
        ))}
      </nav>

      {/* 4-up grid */}
      {filteredRows.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredRows.map((row) => (
            <li key={row.id}>
              <LibraryCard row={row} stat={statsByMealId.get(row.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[14px] border border-dashed bg-[var(--surface-2)] px-6 py-10 text-center text-[13.5px] italic text-muted-foreground">
          {rows.length === 0
            ? "No recipes in your library yet. Use the New recipe button to log your first meal."
            : "No recipes match this filter."}
        </p>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  decorative,
  onClick
}: {
  label: string;
  count: number | null;
  active: boolean;
  decorative?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-[color:var(--sage-soft)] text-primary"
          : "border-border bg-transparent text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground",
        decorative ? "opacity-80" : ""
      )}
      style={{ letterSpacing: "-0.05px" }}
    >
      {label}
      {count !== null ? (
        <span
          className="font-mono text-[10.5px] uppercase opacity-70"
          style={{ letterSpacing: "0.13em" }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function LibraryCard({
  row,
  stat
}: {
  row: LibraryRow;
  stat: LibraryStat | undefined;
}) {
  // Build a compact meta line: cook count + last-cooked relative
  // ("3× cooked · last Mar 4"). When no stats, just "Not yet cooked".
  let meta: string;
  if (stat?.cookCount) {
    const parts: string[] = [
      `${stat.cookCount}× cooked`
    ];
    if (stat.lastCookedAt) {
      const last = new Date(stat.lastCookedAt);
      parts.push(
        `last ${last.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric"
        })}`
      );
    }
    meta = parts.join(" · ");
  } else {
    meta = "Not yet cooked";
  }

  return (
    <Link
      href={`/meal/${row.id}` as Route}
      className="group grid gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Open recipe for ${row.name}`}
    >
      {row.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.photoUrl}
          alt=""
          className="aspect-square w-full rounded-md border bg-muted object-cover transition-opacity group-hover:opacity-90"
        />
      ) : (
        <MealTile
          name={row.name}
          size="m"
          className="aspect-square w-full rounded-md border transition-opacity group-hover:opacity-90"
        />
      )}
      <div className="grid gap-0.5">
        <p className="truncate text-[14px] font-medium text-foreground group-hover:underline">
          {row.name}
        </p>
        <p
          className="font-mono text-[10.5px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.13em" }}
        >
          {meta}
        </p>
        {stat?.effortLevel ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge
              variant={
                stat.effortLevel === "high_effort"
                  ? "terra"
                  : stat.effortLevel === "medium"
                    ? "wheat"
                    : "sage"
              }
              className="text-[10.5px]"
            >
              {stat.effortLevel === "high_effort"
                ? "High effort"
                : stat.effortLevel}
            </Badge>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
