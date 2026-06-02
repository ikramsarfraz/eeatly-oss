"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  ArrowUpDown,
  BookOpen,
  Copy,
  EyeOff,
  Lock,
  Plus,
  Share2,
  Trash2
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealTile } from "@/components/ui/meal-tile";
import { ShareSheet } from "@/components/sharing/share-sheet";
import { useQuickLog } from "@/components/dashboard/quick-log-provider";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { SharedWithMeItem, TombstoneView } from "@/services/sharing";

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
  | "never";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  recent: "Recently cooked",
  most: "Most cooked",
  personal: "Personal",
  shared: "Shared",
  quick: "Quick",
  high: "High effort",
  never: "Never cooked"
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

  // Stats map keyed by mealId.
  const statsByMealId = React.useMemo(() => {
    const map = new Map<string, LibraryStat>();
    for (const stat of stats) map.set(stat.mealId, stat);
    return map;
  }, [stats]);

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
      never
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

  return (
    <div className="grid gap-7">
      {/* `items-start` + `pt-1.5` on the action group cap-aligns the
          "New recipe" button to the top of the serif title. The A–Z sort
          moved into the filter toolbar below (grouped with the filters,
          distinct from the green primary). */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1
            className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[64px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Library.
          </h1>
          {surface === "yours" ? (
            <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
              Everything you&apos;ve saved. Private by default —{" "}
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
        {/* Sort indicator — pushed to the far right (the library is
            sorted A–Z by name server-side). A proper outlined pill with a
            sort icon, visually grouped with the filters and distinct from
            the green "New recipe" primary. */}
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground"
          style={{ letterSpacing: "-0.05px" }}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          A–Z
        </span>
      </nav>

      {/* 4-up grid */}
      {filteredRows.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredRows.map((row) => (
            <li key={row.id}>
              <LibraryCard
                row={row}
                stat={statsByMealId.get(row.id)}
                showPersonalIndicator={
                  isMultiMember && (shareCounts[row.id] ?? 0) === 0
                }
                shareCount={shareCounts[row.id] ?? 0}
                isOwner={row.createdByUserId === currentUserId}
                onShare={() => setShareTarget(row)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[14px] border border-dashed bg-[var(--surface-2)] px-6 py-10 text-center text-[13.5px] italic text-muted-foreground">
          {ownedRows.length === 0
            ? "No recipes in your library yet. Use the New recipe button to log your first meal."
            : "No recipes match this filter."}
        </p>
      )}
        </>
      )}

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
  stat,
  showPersonalIndicator,
  shareCount,
  isOwner,
  onShare
}: {
  row: LibraryRow;
  stat: LibraryStat | undefined;
  /**
   * R32 — gate the MealTile lock indicator. Threaded in as a single
   * boolean so the card stays unopinionated about how the parent
   * derives the "multi-member && personal" condition.
   */
  showPersonalIndicator: boolean;
  /** How many people this item is shared with (owner-side). */
  shareCount: number;
  /** Only the owner sees the Share affordance. */
  isOwner: boolean;
  onShare: () => void;
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
      <span className="relative block">
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
            isPersonal={showPersonalIndicator}
          />
        )}
        {showPersonalIndicator ? (
          <span
            aria-label="Personal meal"
            title="Personal — only you see this"
            className="absolute left-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/85 text-foreground"
          >
            <Lock className="h-3 w-3" strokeWidth={2.2} />
          </span>
        ) : null}
        {isOwner ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShare();
            }}
            className={cn(
              "absolute right-2 top-2 inline-flex h-[30px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
              shareCount > 0
                ? "bg-[color:var(--sage-bg,var(--sage-soft))] text-[color:var(--primary)]"
                : "border bg-[var(--surface)]/90 text-muted-foreground backdrop-blur hover:text-foreground"
            )}
            aria-label={shareCount > 0 ? `Shared with ${shareCount}` : "Share"}
          >
            <Share2 className="h-3.5 w-3.5" />
            {shareCount > 0 ? shareCount : "Share"}
          </button>
        ) : null}
      </span>
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
