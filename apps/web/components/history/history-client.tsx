"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HistoryHeader } from "@/components/history/history-header";
import { HistoryToolbar } from "@/components/history/history-toolbar";
import { HistoryCards } from "@/components/history/history-cards";
import { HistoryRows } from "@/components/history/history-rows";
import { HistoryTable } from "@/components/history/history-table";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import type { HistoryRow, HistorySortDir, HistorySortField, HistoryTab } from "@/services/meals";
import type { EffortLevel } from "@/types";

export type HistoryFilters = {
  tab: HistoryTab;
  sort: HistorySortField;
  dir: HistorySortDir;
  q: string;
  effortLevels: EffortLevel[];
  rangeDays: number | null;
};

type HistoryClientProps = {
  initialRows: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: HistoryFilters;
  currentUserId: string;
  stats: {
    thisYear: number;
    thisMonth: number;
    neglectedCount: number;
  };
  counts: {
    recent: number;
    most: number;
    neglected: number;
  };
};

function filtersToSearch(filters: HistoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab !== "recent") params.set("tab", filters.tab);
  if (filters.sort !== "date") params.set("sort", filters.sort);
  if (filters.dir !== "desc") params.set("dir", filters.dir);
  if (filters.q) params.set("q", filters.q);
  if (filters.effortLevels.length > 0) params.set("effort", filters.effortLevels.join(","));
  if (filters.rangeDays !== null) params.set("range", String(filters.rangeDays));
  return params;
}

export function HistoryClient({
  initialRows,
  total,
  page,
  pageSize,
  filters,
  currentUserId,
  stats,
  counts
}: HistoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bp = useBreakpoint();

  // Debounced query for the search field — keep local state for instant
  // feedback, push to URL on a 250ms cadence so we don't refetch on every
  // keystroke.
  const [searchInput, setSearchInput] = React.useState(filters.q);
  const lastPushed = React.useRef(filters.q);
  React.useEffect(() => {
    if (searchInput === lastPushed.current) return;
    const handle = setTimeout(() => {
      lastPushed.current = searchInput;
      applyFilters({ ...filters, q: searchInput });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function applyFilters(next: HistoryFilters) {
    const params = filtersToSearch(next);
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}` as never);
  }

  function setTab(tab: HistoryTab) {
    applyFilters({ ...filters, tab });
  }

  function setSort(field: HistorySortField) {
    if (filters.sort === field) {
      applyFilters({ ...filters, dir: filters.dir === "asc" ? "desc" : "asc" });
      return;
    }
    applyFilters({ ...filters, sort: field, dir: "desc" });
  }

  function setEffortLevels(next: EffortLevel[]) {
    applyFilters({ ...filters, effortLevels: next });
  }

  function setRangeDays(next: number | null) {
    applyFilters({ ...filters, rangeDays: next });
  }

  function setPage(nextPage: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}` as never);
  }

  return (
    <div className="grid gap-5">
      <HistoryHeader stats={stats} />

      <HistoryToolbar
        bp={bp}
        tab={filters.tab}
        counts={counts}
        onTabChange={setTab}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        effortLevels={filters.effortLevels}
        onEffortLevelsChange={setEffortLevels}
        rangeDays={filters.rangeDays}
        onRangeDaysChange={setRangeDays}
      />

      {initialRows.length === 0 ? (
        <EmptyHistory tab={filters.tab} />
      ) : bp === "mobile" ? (
        <HistoryCards rows={initialRows} currentUserId={currentUserId} />
      ) : bp === "tablet" ? (
        <HistoryRows rows={initialRows} currentUserId={currentUserId} />
      ) : (
        <HistoryTable
          rows={initialRows}
          sort={filters.sort}
          dir={filters.dir}
          onSort={setSort}
          currentUserId={currentUserId}
        />
      )}

      {initialRows.length > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

function EmptyHistory({ tab }: { tab: HistoryTab }) {
  const message =
    tab === "most"
      ? "You'll see your most-cooked meals here once you've logged a few."
      : tab === "neglected"
        ? "Meals you haven't cooked in a while will surface here as your history grows."
        : "No matches. Try clearing filters or widen the time range.";
  return (
    <div className="rounded-[14px] border border-dashed bg-[var(--surface)] p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-border bg-[var(--surface)] px-3 py-1 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40"
        >
          Previous
        </button>
        <span className="font-mono-brand text-[11.5px]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-border bg-[var(--surface)] px-3 py-1 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
