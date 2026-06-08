"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Archive,
  ArrowUpDown,
  BookOpen,
  Check,
  Copy,
  EyeOff,
  LayoutGrid,
  List as ListIcon,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { ScreenTip } from "@/components/tour/screen-tip";
import { MealTile } from "@/components/ui/meal-tile";
import { ShareSheet } from "@/components/sharing/share-sheet";
import { useQuickLog } from "@/components/dashboard/quick-log-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useLibraryManagement } from "@/components/library/use-library-management";
import { FilterPanelBody } from "@/components/library/filter-panel";
import { FACET_GROUPS, effortLabel, type FacetKey } from "@/lib/meals/tags";
import {
  emptyFacetState,
  facetCounts,
  facetOptions,
  matchesFacets,
  totalSelected,
  type FacetRow,
  type FacetState
} from "@/lib/meals/facets";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { SharedWithMeItem, TombstoneView } from "@/services/sharing";

const PAGE_SIZE = 12;

type SortKey = "recent" | "most" | "new" | "az" | "effort";
const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently cooked",
  most: "Most cooked",
  new: "Newest added",
  az: "A to Z",
  effort: "Effort (easy first)"
};
const EFFORT_RANK: Record<string, number> = { quick: 0, easy: 1, medium: 2, high_effort: 3 };

/**
 * Round 28 — editorial Library.
 *
 * Repurposes the `/library` route from a per-cook-log surface to a
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
  createdByUserId: string | null;
  /** Creation order (ISO) — backs the "Newest added" sort. */
  addedAt: string;
  /** R36 — AI tags, for faceted filtering + Edit-tags. */
  cuisine: string | null;
  course: string | null;
  mainIngredient: string | null;
  diet: string[];
  occasion: string[];
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
  /**
   * Round 32 — viewing user id (for "is this MY personal meal?") and
   * household member count (controls whether Personal/Shared chips +
   * tile indicators render at all). Single-member households hide
   * both — no signal to surface when there's nobody to share with.
   */
  currentUserId: string;
  householdMemberCount: number;
  /** Items others have shared with me (the "Shared with you" surface). */
  sharedWithMe: SharedWithMeItem[];
  /** Recently-removed live copies (tombstone strip on the Shared surface). */
  tombstones: TombstoneView[];
  /** Owner-side share counts keyed by mealId (the Yours card share button). */
  shareCounts: Record<string, number>;
  /** Initial surface, from `?surface=shared` deep-links (notifications). */
  initialSurface?: "yours" | "shared";
};

type FilterKey =
  | "all"
  | "recent"
  | "most"
  | "personal"
  | "shared"
  | "quick"
  | "high"
  | "never"
  | "archived";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  recent: "Recently cooked",
  most: "Most cooked",
  personal: "Personal",
  shared: "Shared",
  quick: "Quick",
  high: "High effort",
  never: "Never cooked",
  archived: "Archived"
};

// R32 — Personal + Shared sit between "Most cooked" and the decorative
// effort chips so the visibility filters are visually grouped with the
// other derived filters. Hidden entirely for single-member households.
const DERIVED_FILTERS: ReadonlyArray<FilterKey> = [
  "all",
  "recent",
  "most",
  "never"
];

const VISIBILITY_FILTERS: ReadonlyArray<FilterKey> = ["personal", "shared"];

const DECORATIVE_FILTERS: ReadonlyArray<FilterKey> = ["quick", "high"];

export function LibraryClient({
  rows,
  stats,
  currentUserId,
  householdMemberCount,
  sharedWithMe,
  tombstones,
  shareCounts,
  initialSurface
}: LibraryClientProps) {
  const { open: openQuickLog } = useQuickLog();
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [surface, setSurface] = React.useState<"yours" | "shared">(
    initialSurface ?? "yours"
  );
  const [shareTarget, setShareTarget] = React.useState<LibraryRow | null>(null);

  // R36 — view toggle, sort, "load more" cap, archived view, delete confirm.
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [sort, setSort] = React.useState<SortKey>("recent");
  const [shown, setShown] = React.useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string; cooks: number } | null>(null);
  const [facetState, setFacetState] = React.useState<FacetState>(emptyFacetState);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const isArchived = filter === "archived";
  const manage = useLibraryManagement();

  const toggleFacet = (key: FacetKey, value: string) =>
    setFacetState((s) => {
      const next = { ...s, [key]: new Set(s[key]) };
      if (next[key].has(value)) next[key].delete(value);
      else next[key].add(value);
      return next;
    });
  const activeFacetCount = totalSelected(facetState);

  // Archived recipes are fetched lazily (and reconciled by invalidation) only
  // while the Archived pill is selected.
  const archivedQuery = trpc.meals.archivedList.useQuery(undefined, {
    enabled: isArchived,
    staleTime: 30_000
  });

  // Reset the load-more cap whenever the view's contents change. Done during
  // render (React's sanctioned "adjust state on dependency change" pattern)
  // rather than in an effect, which would cascade an extra render.
  const viewKey = `${filter}:${sort}`;
  const [lastViewKey, setLastViewKey] = React.useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setShown(PAGE_SIZE);
  }

  // Stats map keyed by mealId.
  const statsByMealId = React.useMemo(() => {
    const map = new Map<string, LibraryStat>();
    for (const stat of stats) map.set(stat.mealId, stat);
    return map;
  }, [stats]);

  const toFacetRow = React.useCallback(
    (row: LibraryRow): FacetRow => ({
      cuisine: row.cuisine,
      course: row.course,
      mainIngredient: row.mainIngredient,
      diet: row.diet,
      occasion: row.occasion,
      effort: statsByMealId.get(row.id)?.effortLevel ?? null
    }),
    [statsByMealId]
  );

  // The "Yours" surface is strictly recipes you OWN. `listMealLibrary` is
  // household-scoped + visibility-filtered, so in a multi-member kitchen it
  // also returns items a co-member granted you — those belong only in
  // "Shared with you" (the `sharedWithMe` surface), not here. Partition them
  // out so a shared recipe doesn't appear under both tabs.
  const ownedRows = React.useMemo(
    () => rows.filter((r) => r.createdByUserId === currentUserId),
    [rows, currentUserId]
  );

  // Capture "now" once at mount so re-renders don't move the
  // 30-day window under the user's feet (and so the memo body stays
  // pure — Date.now() inside useMemo trips the react-hooks/purity
  // rule).
  const [now] = React.useState(() => Date.now());
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const isMultiMember = householdMemberCount > 1;

  // Derived counts for chip subtitles. Computed once per stats change.
  const counts = React.useMemo(() => {
    let recent = 0;
    let most = 0;
    let never = 0;
    let personal = 0;
    let shared = 0;
    for (const row of ownedRows) {
      // Per-item: a recipe is "Shared" once you've granted it to ≥1 person
      // (grant counts come from getRecipeShareCounts, owner-side). Everything
      // else you own is "Personal". Only your own recipes carry outbound
      // grants, so a positive count already implies ownership.
      const grantCount = shareCounts[row.id] ?? 0;
      if (grantCount > 0) {
        shared += 1;
      } else if (row.createdByUserId === currentUserId) {
        personal += 1;
      }
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
      all: ownedRows.length,
      recent,
      most,
      personal,
      shared,
      quick: 0,
      high: 0,
      never,
      archived: 0
    } as Record<FilterKey, number>;
  }, [ownedRows, statsByMealId, now, thirtyDays, currentUserId, shareCounts]);

  // Apply filter to the owned rows.
  const filteredRows = React.useMemo(() => {
    if (filter === "all") return ownedRows;
    if (filter === "quick" || filter === "high") {
      // Decorative chips — no filter applied. Equivalent to "All"
      // visually but with the chip styled active. Flagged.
      return ownedRows;
    }
    return ownedRows.filter((row) => {
      const stat = statsByMealId.get(row.id);
      if (filter === "never") return !stat;
      if (filter === "recent") {
        return Boolean(
          stat?.lastCookedAt &&
            now - new Date(stat.lastCookedAt).getTime() <= thirtyDays
        );
      }
      if (filter === "most") return (stat?.cookCount ?? 0) >= 2;
      if (filter === "personal") {
        return (shareCounts[row.id] ?? 0) === 0 && row.createdByUserId === currentUserId;
      }
      if (filter === "shared") {
        return (shareCounts[row.id] ?? 0) > 0;
      }
      return true;
    });
  }, [ownedRows, statsByMealId, filter, now, thirtyDays, currentUserId, shareCounts]);

  // R36 — drop optimistically-archived/deleted rows, then sort, then cap to
  // the load-more window. Ties always break A to Z.
  const sortedRows = React.useMemo(() => {
    const byName = (a: LibraryRow, b: LibraryRow) => a.name.localeCompare(b.name);
    const lastCooked = (r: LibraryRow) => {
      const t = statsByMealId.get(r.id)?.lastCookedAt;
      return t ? new Date(t).getTime() : null;
    };
    const visible = filteredRows.filter(
      (r) => !manage.hiddenIds.has(r.id) && matchesFacets(toFacetRow(r), facetState)
    );
    const out = [...visible];
    out.sort((a, b) => {
      switch (sort) {
        case "az":
          return byName(a, b);
        case "new":
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime() || byName(a, b);
        case "most":
          return (statsByMealId.get(b.id)?.cookCount ?? 0) - (statsByMealId.get(a.id)?.cookCount ?? 0) || byName(a, b);
        case "effort": {
          const ea = EFFORT_RANK[statsByMealId.get(a.id)?.effortLevel ?? ""] ?? 99;
          const eb = EFFORT_RANK[statsByMealId.get(b.id)?.effortLevel ?? ""] ?? 99;
          return ea - eb || byName(a, b);
        }
        case "recent":
        default: {
          const la = lastCooked(a);
          const lb = lastCooked(b);
          if (la === null && lb === null) return byName(a, b);
          if (la === null) return 1; // never-cooked last
          if (lb === null) return -1;
          return lb - la || byName(a, b);
        }
      }
    });
    return out;
  }, [filteredRows, manage.hiddenIds, sort, statsByMealId, facetState, toFacetRow]);

  // Facet options + live counts are computed over the activity-filtered base
  // (so they reflect the current pill but not the facet selection itself).
  const facetRows = React.useMemo(() => filteredRows.map(toFacetRow), [filteredRows, toFacetRow]);
  const facetOpts = React.useMemo(() => facetOptions(facetRows), [facetRows]);
  const facetCountMap = React.useMemo(() => facetCounts(facetRows, facetState), [facetRows, facetState]);

  const pageRows = sortedRows.slice(0, shown);
  const archivedRows = (archivedQuery.data ?? []).filter((r) => !manage.hiddenIds.has(r.id));

  return (
    <div className="grid gap-7">
      {/* `items-start` + `pt-1.5` on the action group cap-aligns the
          "New recipe" button to the top of the serif title. The A–Z sort
          moved into the filter toolbar below (grouped with the filters,
          distinct from the green primary). */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <h1
              className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[64px]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Library.
            </h1>
            <ScreenTip
              title="Your whole cookbook"
              body="Every meal you've saved, searchable and filterable. Click any card to open the recipe."
            />
          </div>
          {surface === "yours" ? (
            <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
              Everything you&apos;ve saved. Private by default:{" "}
              <strong className="text-foreground">nothing is shared until you choose to.</strong>
            </p>
          ) : (
            <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
              Recipes and plans others have shared with you. You see their{" "}
              <strong className="text-foreground">latest version, live.</strong>
            </p>
          )}
        </div>
        {/* Primary action lives in the page header (not the top bar). */}
        <div className="pt-1.5">
          <Button variant="default" className="min-h-[40px]" onClick={openQuickLog}>
            <Plus className="h-3.5 w-3.5" />
            New recipe
          </Button>
        </div>
      </header>

      {/* Surface switch — Yours vs Shared with you. */}
      <div className="inline-flex w-fit gap-1 rounded-[12px] border bg-[var(--paper,var(--surface-2))] p-1">
        <SurfaceTab
          active={surface === "yours"}
          tone="sage"
          icon={<BookOpen className="h-[17px] w-[17px]" />}
          label="Yours"
          count={ownedRows.length}
          onClick={() => setSurface("yours")}
        />
        <SurfaceTab
          active={surface === "shared"}
          tone="terra"
          icon={<Share2 className="h-[17px] w-[17px]" />}
          label="Shared with you"
          count={sharedWithMe.length}
          onClick={() => setSurface("shared")}
        />
      </div>

      {surface === "shared" ? (
        <SharedSurface items={sharedWithMe} tombstones={tombstones} />
      ) : (
        <>
      {/* Filter chip row. R32 — Personal + Shared chips only render
          for multi-member households (no signal in solo kitchens). */}
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
        {isMultiMember
          ? (VISIBILITY_FILTERS as ReadonlyArray<FilterKey>).map((key) => (
              <FilterChip
                key={key}
                active={filter === key}
                count={counts[key]}
                label={FILTER_LABELS[key]}
                onClick={() => setFilter(key)}
              />
            ))
          : null}
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
        <FilterChip
          active={isArchived}
          count={null}
          label={FILTER_LABELS.archived}
          icon={<Archive className="h-3.5 w-3.5" />}
          onClick={() => setFilter("archived")}
        />

        {/* Filters + Sort + Grid/List, pushed to the far right. */}
        <div className="ml-auto flex items-center gap-2">
          {!isArchived ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={cn(
                  // Squared tool button on a white surface — matches the mobile
                  // Filters control (tools are rounded-rects, only chips are pills).
                  "inline-flex items-center gap-1.5 rounded-[11px] border px-3 py-2 text-[12.5px] font-semibold transition-colors",
                  activeFacetCount > 0
                    ? "border-primary bg-secondary text-primary"
                    : "border-border bg-card text-foreground hover:bg-[var(--surface-2)]"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFacetCount > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">
                    {activeFacetCount}
                  </span>
                ) : null}
              </button>
              {filtersOpen ? (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-[340px] rounded-[16px] border border-border bg-[var(--surface)] p-4 shadow-[var(--card-shadow,0_8px_30px_-12px_rgba(40,30,10,0.25))]">
                    <FilterPanelBody
                      options={facetOpts}
                      counts={facetCountMap}
                      state={facetState}
                      onToggle={toggleFacet}
                    />
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <button
                        type="button"
                        onClick={() => setFacetState(emptyFacetState())}
                        className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Clear all
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltersOpen(false)}
                        className="h-9 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {!isArchived ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[11px] border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-foreground hover:bg-[var(--surface-2)]"
                  style={{ letterSpacing: "-0.05px" }}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {SORT_LABELS[sort]}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <DropdownMenuItem key={key} onSelect={() => setSort(key)}>
                    <Check className={cn("h-4 w-4", sort === key ? "opacity-100" : "opacity-0")} />
                    {SORT_LABELS[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <div className="inline-flex rounded-[10px] border border-border bg-card p-0.5">
            <ViewToggleButton active={view === "grid"} onClick={() => setView("grid")} label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ViewToggleButton>
            <ViewToggleButton active={view === "list"} onClick={() => setView("list")} label="List view">
              <ListIcon className="h-4 w-4" />
            </ViewToggleButton>
          </div>
        </div>
      </nav>

      {/* Active facet chips. */}
      {!isArchived && activeFacetCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {FACET_GROUPS.flatMap((group) =>
            [...facetState[group.key]].map((value) => (
              <button
                key={`${group.key}:${value}`}
                type="button"
                onClick={() => toggleFacet(group.key, value)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-[color:var(--sage-soft)] px-2.5 py-1 text-[12px] font-medium text-primary"
              >
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] opacity-70">{group.label}</span>
                {group.key === "effort" ? effortLabel(value) : value}
                <X className="h-3 w-3" />
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setFacetState(emptyFacetState())}
            className="text-[12px] font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {isArchived ? (
        archivedRows.length > 0 ? (
          <ItemCollection view={view}>
            {archivedRows.map((r) => {
              const item: CardItem = {
                id: r.id,
                name: r.name,
                photoUrl: r.photoUrl,
                cookCount: r.cookCount,
                lastCookedAt: r.lastCookedAt,
                effortLevel: null,
                isOwner: r.createdByUserId === currentUserId
              };
              const menu = (
                <RecipeActionMenu
                  id={r.id}
                  archivedView
                  onRestore={() => manage.restore(r.id, r.name)}
                  onDeletePermanent={() => setDeleteTarget({ id: r.id, name: r.name, cooks: r.cookCount })}
                />
              );
              return view === "list" ? (
                <LibraryItemRow key={r.id} item={item} menu={menu} archived />
              ) : (
                <LibraryItemCard key={r.id} item={item} menu={menu} archived />
              );
            })}
          </ItemCollection>
        ) : (
          <p className="rounded-[14px] border border-dashed bg-[var(--surface-2)] px-6 py-10 text-center text-[13.5px] italic text-muted-foreground">
            {archivedQuery.isLoading ? "Loading archived recipes..." : "Nothing archived. Recipes you archive land here."}
          </p>
        )
      ) : sortedRows.length > 0 ? (
        <>
          <ItemCollection view={view}>
            {pageRows.map((row) => {
              const stat = statsByMealId.get(row.id);
              const item: CardItem = {
                id: row.id,
                name: row.name,
                photoUrl: row.photoUrl,
                cookCount: stat?.cookCount ?? 0,
                lastCookedAt: stat?.lastCookedAt ?? null,
                effortLevel: stat?.effortLevel ?? null,
                isOwner: row.createdByUserId === currentUserId,
                showPersonalIndicator: isMultiMember && (shareCounts[row.id] ?? 0) === 0,
                shareCount: shareCounts[row.id] ?? 0,
                onShare: () => setShareTarget(row)
              };
              const menu =
                row.createdByUserId === currentUserId ? (
                  <RecipeActionMenu
                    id={row.id}
                    onArchive={() => manage.archive(row.id, row.name)}
                    onDelete={() => setDeleteTarget({ id: row.id, name: row.name, cooks: stat?.cookCount ?? 0 })}
                  />
                ) : null;
              return view === "list" ? (
                <LibraryItemRow key={row.id} item={item} menu={menu} />
              ) : (
                <LibraryItemCard key={row.id} item={item} menu={menu} />
              );
            })}
          </ItemCollection>

          <div className="flex flex-col items-center gap-2 pt-1">
            {sortedRows.length > shown ? (
              <Button variant="outline" onClick={() => setShown((s) => s + PAGE_SIZE)}>
                Load more
              </Button>
            ) : null}
            <p className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
              Showing {Math.min(shown, sortedRows.length)} of {sortedRows.length}
            </p>
          </div>
        </>
      ) : (
        <p className="rounded-[14px] border border-dashed bg-[var(--surface-2)] px-6 py-10 text-center text-[13.5px] italic text-muted-foreground">
          {ownedRows.length === 0
            ? "No recipes in your library yet. Use the New recipe button to log your first meal."
            : "No recipes match this filter."}
        </p>
      )}
        </>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--terra-soft,#f3e0d7)] text-[color:var(--terra,var(--destructive))]">
                <Trash2 className="h-4 w-4" />
              </span>
              Delete &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.cooks > 0
                ? `This removes the recipe and its ${deleteTarget.cooks} logged cook${deleteTarget.cooks === 1 ? "" : "s"}. You can undo right after.`
                : "This removes the recipe from your library. You can undo right after."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[color:var(--terra,var(--destructive))] text-white hover:opacity-90"
              onClick={() => {
                if (deleteTarget) {
                  if (isArchived) manage.removePermanent(deleteTarget.id, deleteTarget.name);
                  else manage.remove(deleteTarget.id, deleteTarget.name);
                }
                setDeleteTarget(null);
              }}
            >
              Delete recipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {shareTarget ? (
        <ShareSheet
          itemType="recipe"
          itemId={shareTarget.id}
          itemName={shareTarget.name}
          open={shareTarget !== null}
          onOpenChange={(o) => !o && setShareTarget(null)}
        />
      ) : null}
    </div>
  );
}

function SurfaceTab({
  active,
  tone,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  tone: "sage" | "terra";
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[9px] px-[18px] text-[14px] font-semibold transition-colors",
        active
          ? cn(
              "bg-[var(--surface)] shadow-[var(--shadow-sm)]",
              tone === "terra" ? "text-[color:var(--terra-fg)]" : "text-foreground"
            )
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "rounded-full px-[7px] py-px font-mono text-[11px] font-semibold",
          active && tone === "sage" && "bg-[color:var(--sage-bg,var(--sage-soft))] text-[color:var(--primary)]",
          active && tone === "terra" && "bg-[color:var(--terra-soft)] text-[color:var(--terra-fg)]",
          !active && "bg-[var(--surface-2)] text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function FilterChip({
  label,
  count,
  active,
  decorative,
  icon,
  onClick
}: {
  label: string;
  count: number | null;
  active: boolean;
  decorative?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // Activity chips stay pills (rounded-full) on a white surface — matches
        // the mobile chips (active = filled forest, inactive = white card).
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground",
        decorative ? "opacity-80" : ""
      )}
      style={{ letterSpacing: "-0.05px" }}
    >
      {icon}
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

/** Normalized shape consumed by the grid card + list row (active or archived). */
type CardItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  cookCount: number;
  lastCookedAt: string | null;
  effortLevel: LibraryStat["effortLevel"];
  isOwner: boolean;
  showPersonalIndicator?: boolean;
  shareCount?: number;
  onShare?: () => void;
};

function metaLine(item: Pick<CardItem, "cookCount" | "lastCookedAt">): string {
  if (!item.cookCount) return "Not yet cooked";
  const parts = [`${item.cookCount}× cooked`];
  if (item.lastCookedAt) {
    parts.push(
      `last ${new Date(item.lastCookedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
    );
  }
  return parts.join(" · ");
}

function effortBadge(level: LibraryStat["effortLevel"]) {
  if (!level) return null;
  return (
    <Badge
      variant={level === "high_effort" ? "terra" : level === "medium" ? "wheat" : "sage"}
      className="text-[10.5px]"
    >
      {level === "high_effort" ? "High effort" : level}
    </Badge>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  children
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        // Squared inner buttons (radius 7) inside the rounded-[10px] container,
        // matching the mobile Grid/List toggle.
        "flex h-8 w-8 items-center justify-center rounded-[7px] transition-colors",
        active ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ItemCollection({ view, children }: { view: "grid" | "list"; children: React.ReactNode }) {
  return view === "list" ? (
    <ul className="divide-y divide-border overflow-hidden rounded-[14px] border bg-[var(--surface)]">{children}</ul>
  ) : (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
  );
}

/** The ⋯ action menu shared by the grid card + list row. */
function RecipeActionMenu({
  id,
  archivedView,
  onArchive,
  onDelete,
  onRestore,
  onDeletePermanent
}: {
  id: string;
  archivedView?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
}) {
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Recipe actions"
          onClick={stop}
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--surface)]/90 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        <DropdownMenuItem asChild>
          <Link href={`/meal/${id}` as Route}>
            <BookOpen className="h-4 w-4" />
            Open recipe
          </Link>
        </DropdownMenuItem>
        {archivedView ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRestore}>
              <RotateCcw className="h-4 w-4" />
              Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDeletePermanent}
              className="text-[color:var(--terra,var(--destructive))] focus:text-[color:var(--terra,var(--destructive))]"
            >
              <Trash2 className="h-4 w-4" />
              Delete permanently
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/meal/${id}/edit` as Route}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              <Archive className="h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-[color:var(--terra,var(--destructive))] focus:text-[color:var(--terra,var(--destructive))]"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact list-view row. */
function LibraryItemRow({ item, menu, archived }: { item: CardItem; menu: React.ReactNode; archived?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)]">
      <Link href={`/meal/${item.id}` as Route} className="flex min-w-0 flex-1 items-center gap-3">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt="" className="h-[46px] w-[46px] shrink-0 rounded-md border object-cover" />
        ) : (
          <MealTile name={item.name} size="s" className="h-[46px] w-[46px] shrink-0 rounded-md border" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-foreground">{item.name}</span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-muted-foreground">
            {metaLine(item)}
          </span>
        </span>
      </Link>
      {effortBadge(item.effortLevel)}
      {item.isOwner && !archived ? menu : archived ? menu : null}
    </li>
  );
}

/** Grid-view card over a normalized {@link CardItem}, with the ⋯ menu + (active
 *  only) the Share affordance + personal-meal indicator. */
function LibraryItemCard({
  item,
  menu,
  archived
}: {
  item: CardItem;
  menu: React.ReactNode;
  archived?: boolean;
}) {
  // Warm the Share sheet's queries on hover/focus so it opens populated.
  const utils = trpc.useUtils();
  const prefetchShare = React.useCallback(() => {
    void utils.sharing.connections.prefetch(undefined, { staleTime: 30_000 });
    void utils.sharing.grantsForItem.prefetch(
      { itemType: "recipe", itemId: item.id },
      { staleTime: 30_000 }
    );
    void utils.shares.activeForMeal.prefetch({ mealId: item.id }, { staleTime: 30_000 });
  }, [utils, item.id]);

  return (
    <li>
      <Link
        href={`/meal/${item.id}` as Route}
        className="group grid gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open recipe for ${item.name}`}
      >
        <span className="relative block">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photoUrl}
              alt=""
              className="aspect-square w-full rounded-md border bg-muted object-cover transition-opacity group-hover:opacity-90"
            />
          ) : (
            <MealTile
              name={item.name}
              size="m"
              className="aspect-square w-full rounded-md border transition-opacity group-hover:opacity-90"
              isPersonal={item.showPersonalIndicator}
            />
          )}
          {item.showPersonalIndicator ? (
            <span
              aria-label="Personal meal"
              title="Personal, only you see this"
              className="absolute left-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/85 text-foreground"
            >
              <Lock className="h-3 w-3" strokeWidth={2.2} />
            </span>
          ) : null}

          {/* Top-right controls: ⋯ menu (always) + Share (active, owner). */}
          <span className="absolute right-2 top-2 flex items-center gap-1.5">
            {!archived && item.isOwner && item.onShare ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  item.onShare?.();
                }}
                onPointerEnter={prefetchShare}
                onFocus={prefetchShare}
                className={cn(
                  "inline-flex h-[30px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                  (item.shareCount ?? 0) > 0
                    ? "bg-[color:var(--sage-bg,var(--sage-soft))] text-[color:var(--primary)]"
                    : "border bg-[var(--surface)]/90 text-muted-foreground backdrop-blur hover:text-foreground"
                )}
                aria-label={(item.shareCount ?? 0) > 0 ? `Shared with ${item.shareCount}` : "Share"}
              >
                <Share2 className="h-3.5 w-3.5" />
                {(item.shareCount ?? 0) > 0 ? item.shareCount : "Share"}
              </button>
            ) : null}
            {menu}
          </span>
        </span>
        <div className="grid gap-0.5">
          <p className="truncate text-[14px] font-medium text-foreground group-hover:underline">{item.name}</p>
          <p className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.13em" }}>
            {metaLine(item)}
          </p>
          {item.effortLevel ? <div className="mt-1 flex flex-wrap items-center gap-1">{effortBadge(item.effortLevel)}</div> : null}
        </div>
      </Link>
    </li>
  );
}

/* ─── Shared-with-you surface ─────────────────────────────────────── */

function SharedSurface({
  items,
  tombstones
}: {
  items: SharedWithMeItem[];
  tombstones: TombstoneView[];
}) {
  return (
    <div className="grid gap-6">
      <div className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-muted-foreground">
        <span className="mt-0.5 text-[color:var(--terra-fg)]">ⓘ</span>
        <p>
          These are live views owned by someone else — they update when the owner edits, and you
          can&apos;t change them. Want to tweak one?{" "}
          <strong className="text-foreground">Save your own copy.</strong>
        </p>
      </div>

      {tombstones.length > 0 ? <TombstoneStrip tombstones={tombstones} /> : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={`${item.itemType}:${item.itemId}`}>
              <SharedCard item={item} />
            </li>
          ))}
        </ul>
      ) : tombstones.length === 0 ? (
        <p className="rounded-[14px] border border-dashed bg-[var(--surface-2)] px-6 py-10 text-center text-[13.5px] italic text-muted-foreground">
          Nothing shared with you yet. When someone shares a recipe or plan, it shows up here.
        </p>
      ) : null}
    </div>
  );
}

function SharedCard({ item }: { item: SharedWithMeItem }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const router = useRouter();
  const [savedId, setSavedId] = React.useState<string | null>(item.savedCopyItemId);

  const save = trpc.sharing.saveCopy.useMutation({
    onSuccess: (res) => {
      setSavedId(res.newItemId);
      void utils.sharing.sharedWithMe.invalidate();
      showToast({ variant: "success", title: "Saved to your library" });
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't save copy", description: e.message })
  });

  const copyHref = (id: string): Route =>
    item.itemType === "recipe" ? (`/meal/${id}` as Route) : (`/plans/${id}` as Route);
  const ownerLabel = `${item.ownerName ?? "Someone"}'s ${item.itemType}`;
  const href =
    item.itemType === "recipe"
      ? (`/meal/${item.itemId}` as Route)
      : (`/plans/${item.itemId}` as Route);

  return (
    <div className="grid gap-2">
      <Link href={href} className="group relative block" aria-label={`Open ${item.name}`}>
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt=""
            className="aspect-square w-full rounded-md border bg-muted object-cover transition-opacity group-hover:opacity-90"
          />
        ) : (
          <MealTile
            name={item.name}
            size="m"
            className="aspect-square w-full rounded-md border transition-opacity group-hover:opacity-90"
          />
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)]/90 px-2 py-1 font-mono text-[9.5px] font-semibold uppercase text-[color:var(--primary)] backdrop-blur">
          <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[color:var(--forest-soft,var(--primary))]" />
          Live
        </span>
      </Link>
      <div className="grid gap-0.5">
        <p className="truncate text-[14px] font-medium text-foreground">{item.name}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.13em" }}>
            {ownerLabel}
          </span>
          <span className="shrink-0 font-mono text-[9.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.13em" }}>
            View only
          </span>
        </div>
        {savedId ? (
          <button
            type="button"
            onClick={() => router.push(copyHref(savedId))}
            className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-[color:var(--sage-bg,var(--sage-soft))] px-3 py-1.5 text-[12px] font-medium text-[color:var(--primary)]"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy in your library — open
          </button>
        ) : (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ itemType: item.itemType, itemId: item.itemId })}
            className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-[var(--surface-2)]"
          >
            <Copy className="h-3.5 w-3.5" />
            Save a copy to edit
          </button>
        )}
      </div>
    </div>
  );
}

function TombstoneStrip({ tombstones }: { tombstones: TombstoneView[] }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const router = useRouter();
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  const dismiss = trpc.sharing.dismissTombstone.useMutation({
    onSuccess: () => void utils.sharing.tombstones.invalidate(),
    onError: (e) => showToast({ variant: "error", title: "Couldn't dismiss", description: e.message })
  });

  const visible = tombstones.filter((t) => !hidden.has(t.id));
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-2">
      <p className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.14em" }}>
        Recently removed
      </p>
      <div className="grid gap-2">
        {visible.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center gap-3 rounded-[14px] border bg-[var(--paper,var(--surface-2))] px-4 py-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-2)] text-muted-foreground">
              {t.kind === "deleted" ? <Trash2 className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-muted-foreground">
                {t.kind === "deleted" ? (
                  <>
                    <s>{t.itemName}</s> was deleted by {t.ownerName ?? "the owner"}
                  </>
                ) : (
                  <>
                    {t.ownerName ?? "Someone"} removed your access to <s>{t.itemName}</s>
                  </>
                )}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {t.savedCopyItemId
                  ? "The live copy is gone. Your saved copy is unaffected."
                  : "This was a live recipe you didn't copy, so it's no longer available."}
              </p>
            </div>
            {t.savedCopyItemId ? (
              <Button
                variant="outline"
                className="min-h-[34px]"
                onClick={() => router.push(`/meal/${t.savedCopyItemId}` as Route)}
              >
                Open my copy
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="min-h-[34px]"
              onClick={() => {
                setHidden((prev) => new Set(prev).add(t.id));
                dismiss.mutate({ tombstoneId: t.id });
              }}
            >
              Dismiss
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
