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
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2
} from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { MealTile } from "@/components/ui/meal-tile";
import { EffortPill } from "@/components/history/effort-pill";
import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";
import { MobileSheet, SheetRow } from "@/components/mobile/mobile-sheet";
import { useLibraryManagement } from "@/components/library/use-library-management";
import type { LibraryRow, LibraryStat } from "@/components/library/library-client";
import type { SharedWithMeItem } from "@/services/sharing";
import type { EffortLevel } from "@/types";

type FilterKey = "all" | "recent" | "most" | "never" | "archived";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recent", label: "Recently cooked" },
  { key: "most", label: "Most cooked" },
  { key: "never", label: "Never cooked" },
  { key: "archived", label: "Archived" }
];

type SortKey = "recent" | "most" | "new" | "az" | "effort";
const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently cooked",
  most: "Most cooked",
  new: "Newest added",
  az: "A to Z",
  effort: "Effort (easy first)"
};
const EFFORT_RANK: Record<string, number> = { quick: 0, easy: 1, medium: 2, high_effort: 3 };

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 12;

/** A meal targeted by the action sheet / delete confirm. */
type Target = { id: string; name: string; cooks: number; archived: boolean };

/**
 * R36 mobile-web Library. Extends the R35 grid with per-recipe management
 * (Archive / Delete via a ⋯ action sheet + Undo toasts), an Archived view,
 * Sort sheet, Grid/List toggle, and "Load more". Mirrors the desktop client.
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
  const [sort, setSort] = React.useState<SortKey>("recent");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [shown, setShown] = React.useState(PAGE_SIZE);
  const [now] = React.useState(() => Date.now());

  const [sortSheet, setSortSheet] = React.useState(false);
  const [actionTarget, setActionTarget] = React.useState<Target | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Target | null>(null);

  const isArchived = filter === "archived";
  const manage = useLibraryManagement();
  const archivedQuery = trpc.meals.archivedList.useQuery(undefined, {
    enabled: isArchived,
    staleTime: 30_000
  });

  // Reset the load-more cap when the view's contents change (render-time).
  const viewKey = `${filter}:${sort}`;
  const [lastViewKey, setLastViewKey] = React.useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setShown(PAGE_SIZE);
  }

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

  const sortedRows = React.useMemo(() => {
    const byName = (a: LibraryRow, b: LibraryRow) => a.name.localeCompare(b.name);
    const filtered = ownedRows.filter((row) => {
      if (manage.hiddenIds.has(row.id)) return false;
      if (filter === "all") return true;
      const stat = statsByMealId.get(row.id);
      if (filter === "never") return !stat;
      if (filter === "recent") {
        return Boolean(stat?.lastCookedAt && now - new Date(stat.lastCookedAt).getTime() <= THIRTY_DAYS);
      }
      if (filter === "most") return (stat?.cookCount ?? 0) >= 2;
      return true;
    });
    return filtered.sort((a, b) => {
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
          const la = statsByMealId.get(a.id)?.lastCookedAt;
          const lb = statsByMealId.get(b.id)?.lastCookedAt;
          if (!la && !lb) return byName(a, b);
          if (!la) return 1;
          if (!lb) return -1;
          return new Date(lb).getTime() - new Date(la).getTime() || byName(a, b);
        }
      }
    });
  }, [ownedRows, statsByMealId, filter, sort, now, manage.hiddenIds]);

  const pageRows = sortedRows.slice(0, shown);
  const archivedRows = (archivedQuery.data ?? []).filter((r) => !manage.hiddenIds.has(r.id));

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
          {/* Sort + Grid/List */}
          <div className="flex items-center gap-2 px-4 pt-3">
            {!isArchived && (
              <button
                type="button"
                onClick={() => setSortSheet(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {SORT_LABELS[sort]}
              </button>
            )}
            <div className="ml-auto inline-flex rounded-full border border-border p-0.5">
              <ViewBtn active={view === "grid"} onClick={() => setView("grid")} label="Grid view">
                <LayoutGrid className="h-4 w-4" />
              </ViewBtn>
              <ViewBtn active={view === "list"} onClick={() => setView("list")} label="List view">
                <ListIcon className="h-4 w-4" />
              </ViewBtn>
            </div>
          </div>

          {/* Activity chips */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.key === "archived" && <Archive className="h-3 w-3" />}
                {f.label}
              </Chip>
            ))}
          </div>

          {isArchived ? (
            archivedRows.length === 0 ? (
              <EmptyState>
                {archivedQuery.isLoading ? "Loading archived recipes..." : "Nothing archived yet."}
              </EmptyState>
            ) : view === "list" ? (
              <ListView>
                {archivedRows.map((r) => (
                  <RecipeRow
                    key={r.id}
                    id={r.id}
                    name={r.name}
                    effort={null}
                    meta={metaForCount(r.cookCount)}
                    onMenu={() => setActionTarget({ id: r.id, name: r.name, cooks: r.cookCount, archived: true })}
                  />
                ))}
              </ListView>
            ) : (
              <Grid>
                {archivedRows.map((r) => (
                  <RecipeCard
                    key={r.id}
                    id={r.id}
                    name={r.name}
                    effort={null}
                    meta={metaForCount(r.cookCount)}
                    onMenu={() => setActionTarget({ id: r.id, name: r.name, cooks: r.cookCount, archived: true })}
                  />
                ))}
              </Grid>
            )
          ) : sortedRows.length === 0 ? (
            <EmptyState>No recipes match this filter yet.</EmptyState>
          ) : (
            <>
              {view === "list" ? (
                <ListView>
                  {pageRows.map((row) => {
                    const stat = statsByMealId.get(row.id);
                    return (
                      <RecipeRow
                        key={row.id}
                        id={row.id}
                        name={row.name}
                        effort={stat?.effortLevel ?? null}
                        meta={metaFor(stat ?? null)}
                        onMenu={() =>
                          setActionTarget({ id: row.id, name: row.name, cooks: stat?.cookCount ?? 0, archived: false })
                        }
                      />
                    );
                  })}
                </ListView>
              ) : (
                <Grid>
                  {pageRows.map((row) => {
                    const stat = statsByMealId.get(row.id);
                    return (
                      <RecipeCard
                        key={row.id}
                        id={row.id}
                        name={row.name}
                        effort={stat?.effortLevel ?? null}
                        meta={metaFor(stat ?? null)}
                        onMenu={() =>
                          setActionTarget({ id: row.id, name: row.name, cooks: stat?.cookCount ?? 0, archived: false })
                        }
                      />
                    );
                  })}
                </Grid>
              )}
              {sortedRows.length > shown && (
                <div className="flex flex-col items-center gap-2 px-4 pb-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShown((s) => s + PAGE_SIZE)}
                    className="h-10 rounded-[12px] border border-border bg-card px-5 text-[14px] font-semibold text-foreground"
                  >
                    Load more
                  </button>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink3)]">
                    Showing {Math.min(shown, sortedRows.length)} of {sortedRows.length}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      ) : sharedRecipes.length === 0 ? (
        <EmptyState>Nothing has been shared with you yet.</EmptyState>
      ) : (
        <Grid>
          {sharedRecipes.map((item) => (
            <RecipeCard
              key={item.itemId}
              id={item.itemId}
              name={item.name}
              effort={null}
              meta={item.ownerName ? `From ${item.ownerName}` : "Shared with you"}
            />
          ))}
        </Grid>
      )}

      {/* Sort sheet */}
      <MobileSheet open={sortSheet} label="Sort by" onClose={() => setSortSheet(false)}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSort(key);
              setSortSheet(false);
            }}
            className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-left text-[15px] text-foreground active:bg-[color:var(--surface-2)]"
          >
            {SORT_LABELS[key]}
            {sort === key && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </MobileSheet>

      {/* Action sheet */}
      <MobileSheet
        open={actionTarget !== null}
        label={actionTarget?.name}
        onClose={() => setActionTarget(null)}
      >
        {actionTarget && (
          <ActionSheetBody
            target={actionTarget}
            onClose={() => setActionTarget(null)}
            onArchive={() => manage.archive(actionTarget.id, actionTarget.name)}
            onRestore={() => manage.restore(actionTarget.id, actionTarget.name)}
            onDelete={() => setDeleteTarget(actionTarget)}
          />
        )}
      </MobileSheet>

      {/* Delete confirm (centered) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 md:hidden">
          <div className="ae-scrim absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-[20px] border border-border bg-background p-5 text-center font-[family-name:var(--font-geist)] shadow-xl">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--danger-soft,#f3e0d7)] text-[color:var(--danger,#b24a2e)]">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-[20px] text-foreground">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground">
              {deleteTarget.cooks > 0
                ? `This removes the recipe and its ${deleteTarget.cooks} logged cook${deleteTarget.cooks === 1 ? "" : "s"}. You can undo right after.`
                : "This removes the recipe from your library. You can undo right after."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-11 rounded-[12px] border border-border bg-card text-[14px] font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTarget.archived) manage.removePermanent(deleteTarget.id, deleteTarget.name);
                  else manage.remove(deleteTarget.id, deleteTarget.name);
                  setDeleteTarget(null);
                }}
                className="h-11 rounded-[12px] bg-[color:var(--danger,#b24a2e)] text-[14px] font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileScaffold>
  );
}

function ActionSheetBody({
  target,
  onClose,
  onArchive,
  onRestore,
  onDelete
}: {
  target: Target;
  onClose: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const go = (href: Route) => {
    onClose();
    router.push(href);
  };
  return (
    <>
      <SheetRow
        icon={<BookOpen className="h-5 w-5" />}
        label="Open recipe"
        onClick={() => go(`/meal/${target.id}` as Route)}
      />
      {target.archived ? (
        <>
          <SheetRow
            accent
            icon={<RotateCcw className="h-5 w-5" />}
            label="Restore"
            onClick={() => {
              onRestore();
              onClose();
            }}
          />
          <SheetRow
            danger
            icon={<Trash2 className="h-5 w-5" />}
            label="Delete permanently"
            onClick={() => {
              onClose();
              onDelete();
            }}
          />
        </>
      ) : (
        <>
          <SheetRow
            icon={<Pencil className="h-5 w-5" />}
            label="Edit"
            onClick={() => go(`/meal/${target.id}/edit` as Route)}
          />
          <SheetRow
            icon={<Archive className="h-5 w-5" />}
            label="Archive"
            onClick={() => {
              onArchive();
              onClose();
            }}
          />
          <SheetRow
            danger
            icon={<Trash2 className="h-5 w-5" />}
            label="Delete"
            onClick={() => {
              onClose();
              onDelete();
            }}
          />
        </>
      )}
    </>
  );
}

function metaFor(stat: LibraryStat | null): string {
  if (!stat || stat.cookCount <= 0) return "Not yet cooked";
  return metaForCount(stat.cookCount);
}
function metaForCount(cookCount: number): string {
  if (cookCount <= 0) return "Not yet cooked";
  return `Cooked ${cookCount}${cookCount === 1 ? " time" : " times"}`;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 px-4 pb-3 pt-3">{children}</div>;
}

function ListView({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
      {children}
    </div>
  );
}

function RecipeCard({
  id,
  name,
  effort,
  meta,
  onMenu
}: {
  id: string;
  name: string;
  effort: EffortLevel | null;
  meta: string;
  onMenu?: () => void;
}) {
  return (
    <div className="relative">
      <Link href={`/meal/${id}` as Route} className="block">
        <MealTile name={name} size="m" className="aspect-square w-full rounded-[14px] border" />
        <p className="mt-2 line-clamp-2 text-[14px] font-medium leading-tight text-foreground">{name}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {effort ? <EffortPill level={effort} compact /> : null}
          <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
            {meta}
          </span>
        </div>
      </Link>
      {onMenu && (
        <button
          type="button"
          aria-label="Recipe actions"
          onClick={onMenu}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-foreground backdrop-blur"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function RecipeRow({
  id,
  name,
  effort,
  meta,
  onMenu
}: {
  id: string;
  name: string;
  effort: EffortLevel | null;
  meta: string;
  onMenu?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Link href={`/meal/${id}` as Route} className="flex min-w-0 flex-1 items-center gap-3">
        <MealTile name={name} size="s" className="h-11 w-11 shrink-0 rounded-[10px] border" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium text-foreground">{name}</span>
          <span className="flex items-center gap-2">
            {effort ? <EffortPill level={effort} compact /> : null}
            <span className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">{meta}</span>
          </span>
        </span>
      </Link>
      {onMenu && (
        <button
          type="button"
          aria-label="Recipe actions"
          onClick={onMenu}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--ink3)]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function ViewBtn({
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
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        active ? "bg-secondary text-primary" : "text-[color:var(--ink3)]"
      )}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-12 text-center text-[14px] text-muted-foreground">{children}</div>;
}
