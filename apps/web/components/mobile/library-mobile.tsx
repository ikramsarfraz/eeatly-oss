"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { MealTile } from "@/components/ui/meal-tile";
import { EffortPill } from "@/components/history/effort-pill";
import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";
import type { LibraryRow, LibraryStat } from "@/components/library/library-client";
import type { SharedWithMeItem } from "@/services/sharing";
import type { EffortLevel } from "@/types";

type FilterKey = "all" | "recent" | "most" | "never";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recent", label: "Recently cooked" },
  { key: "most", label: "Most cooked" },
  { key: "never", label: "Never cooked" }
];

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * R35 mobile-web Library. Renders below `md`; the desktop `<LibraryClient>`
 * renders `hidden md:block` alongside, both off the same server props. Mirrors
 * the desktop owned-rows partition + filter logic (all / recently cooked /
 * most cooked / never cooked) and the Yours/Shared surface split.
 */
export function LibraryMobile({
  rows,
  stats,
  currentUserId,
  householdMemberCount,
  sharedWithMe,
  initialSurface
}: {
  rows: LibraryRow[];
  stats: LibraryStat[];
  currentUserId: string;
  householdMemberCount: number;
  sharedWithMe: SharedWithMeItem[];
  initialSurface?: "yours" | "shared";
}) {
  const [surface, setSurface] = React.useState<"yours" | "shared">(initialSurface ?? "yours");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [now] = React.useState(() => Date.now());

  const statsByMealId = React.useMemo(() => {
    const map = new Map<string, LibraryStat>();
    for (const s of stats) map.set(s.mealId, s);
    return map;
  }, [stats]);

  const ownedRows = React.useMemo(
    () => rows.filter((r) => r.createdByUserId === currentUserId),
    [rows, currentUserId]
  );

  const sharedRecipes = React.useMemo(
    () => sharedWithMe.filter((i) => i.itemType === "recipe"),
    [sharedWithMe]
  );
  const showSurfaceToggle = householdMemberCount > 1 || sharedRecipes.length > 0;

  const filteredRows = React.useMemo(() => {
    if (filter === "all") return ownedRows;
    return ownedRows.filter((row) => {
      const stat = statsByMealId.get(row.id);
      if (filter === "never") return !stat;
      if (filter === "recent") {
        return Boolean(stat?.lastCookedAt && now - new Date(stat.lastCookedAt).getTime() <= THIRTY_DAYS);
      }
      if (filter === "most") return (stat?.cookCount ?? 0) >= 2;
      return true;
    });
  }, [ownedRows, statsByMealId, filter, now]);

  return (
    <MobileScaffold>
      <MobileTopBar
        big
        eyebrow="Your cookbook"
        title="Library."
        right={
          <Link
            href={"/search" as Route}
            aria-label="Search recipes"
            className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground"
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>
        }
      />

      <div className="px-4 pt-3">
        <Link
          href="/add"
          className="flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-primary text-[14px] font-semibold text-primary-foreground active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          New recipe
        </Link>
      </div>

      {showSurfaceToggle && (
        <div className="px-4 pt-3">
          <div className="flex rounded-[12px] border border-border bg-[color:var(--surface-2)] p-1">
            <SegBtn active={surface === "yours"} onClick={() => setSurface("yours")}>
              Yours
            </SegBtn>
            <SegBtn active={surface === "shared"} onClick={() => setSurface("shared")}>
              Shared with you
            </SegBtn>
          </div>
        </div>
      )}

      {surface === "yours" ? (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </Chip>
            ))}
          </div>
          {filteredRows.length === 0 ? (
            <EmptyState>No recipes match this filter yet.</EmptyState>
          ) : (
            <Grid>
              {filteredRows.map((row) => (
                <RecipeCard
                  key={row.id}
                  href={`/meal/${row.id}`}
                  name={row.name}
                  effort={statsByMealId.get(row.id)?.effortLevel ?? null}
                  meta={metaFor(statsByMealId.get(row.id) ?? null)}
                />
              ))}
            </Grid>
          )}
        </>
      ) : sharedRecipes.length === 0 ? (
        <EmptyState>Nothing has been shared with you yet.</EmptyState>
      ) : (
        <Grid>
          {sharedRecipes.map((item) => (
            <RecipeCard
              key={item.itemId}
              href={`/meal/${item.itemId}`}
              name={item.name}
              effort={null}
              meta={item.ownerName ? `From ${item.ownerName}` : "Shared with you"}
            />
          ))}
        </Grid>
      )}
    </MobileScaffold>
  );
}

function metaFor(stat: LibraryStat | null): string {
  if (!stat) return "Not yet cooked";
  if (stat.cookCount <= 0) return "Not yet cooked";
  return `Cooked ${stat.cookCount}${stat.cookCount === 1 ? " time" : " times"}`;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 px-4 pb-3 pt-3">{children}</div>;
}

function RecipeCard({
  href,
  name,
  effort,
  meta
}: {
  href: string;
  name: string;
  effort: EffortLevel | null;
  meta: string;
}) {
  return (
    <Link href={href as Route} className="block">
      <MealTile name={name} size="m" className="aspect-square w-full rounded-[14px] border" />
      <p className="mt-2 line-clamp-2 text-[14px] font-medium leading-tight text-foreground">{name}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {effort ? (
          <EffortPill level={effort} compact />
        ) : null}
        <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
          {meta}
        </span>
      </div>
    </Link>
  );
}

function SegBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-[9px] py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-card text-foreground shadow-[0_1px_2px_rgba(20,20,15,0.08)]" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-[14px] text-muted-foreground">{children}</div>
  );
}
