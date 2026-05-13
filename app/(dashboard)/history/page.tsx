import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import {
  getHistoryRows,
  getHistoryStats,
  type HistoryTab,
  type HistorySortDir,
  type HistorySortField
} from "@/services/meals";
import { HistoryClient, type HistoryFilters } from "@/components/history/history-client";
import type { EffortLevel } from "@/types";

export const metadata: Metadata = {
  title: "History"
};

const EFFORT_VALUES: ReadonlyArray<EffortLevel> = ["quick", "easy", "medium", "high_effort"];

function parseTab(raw: string | undefined): HistoryTab {
  if (raw === "most" || raw === "neglected") return raw;
  return "recent";
}

function parseSort(raw: string | undefined): HistorySortField {
  return raw === "name" ? "name" : "date";
}

function parseDir(raw: string | undefined): HistorySortDir {
  return raw === "asc" ? "asc" : "desc";
}

function parseEffort(raw: string | undefined): EffortLevel[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is EffortLevel => EFFORT_VALUES.includes(v as EffortLevel));
}

function parseRange(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(3650, Math.floor(n));
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function HistoryPage(props: {
  searchParams: Promise<{
    tab?: string;
    sort?: string;
    dir?: string;
    q?: string;
    effort?: string;
    range?: string;
    page?: string;
  }>;
}) {
  const { user, household } = await requireCurrentUserWithHousehold();
  const sp = await props.searchParams;

  const filters: HistoryFilters = {
    tab: parseTab(sp.tab),
    sort: parseSort(sp.sort),
    dir: parseDir(sp.dir),
    q: typeof sp.q === "string" ? sp.q : "",
    effortLevels: parseEffort(sp.effort),
    rangeDays: parseRange(sp.range)
  };
  const page = parsePage(sp.page);

  const [rowsResult, stats] = await Promise.all([
    getHistoryRows(user.id, household.id, {
      tab: filters.tab,
      sort: filters.sort,
      dir: filters.dir,
      effortLevels: filters.effortLevels,
      rangeDays: filters.rangeDays,
      q: filters.q,
      page,
      pageSize: 20
    }),
    getHistoryStats(user.id, household.id)
  ]);

  return (
    <HistoryClient
      initialRows={rowsResult.rows}
      total={rowsResult.total}
      page={rowsResult.page}
      pageSize={rowsResult.pageSize}
      filters={filters}
      currentUserId={user.id}
      stats={{
        thisYear: stats.thisYear,
        thisMonth: stats.thisMonth,
        neglectedCount: stats.neglectedCount
      }}
      counts={stats.counts}
    />
  );
}
