"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { format, parseISO } from "date-fns";
import {
  ArchiveRestore,
  CalendarDays,
  Check,
  Edit3,
  GripVertical,
  Loader2,
  Lock
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MealTile } from "@/components/ui/meal-tile";
import { SectionLabel } from "@/components/ui/section-label";

import { AddDishPicker } from "@/components/plans/add-dish-picker";
import { AnnotationEditor } from "@/components/plans/annotation-editor";
import { WhoCanSeeStrip } from "@/components/sharing/who-can-see-strip";
import { useSetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

/**
 * Round 28 — editorial Plan Detail.
 *
 * Stack (top to bottom):
 *   1. Hero — single editorial column: "Plan" eyebrow + 64–80px display
 *      name + chip row (date / dish count / effort) + Edit/Archive
 *      actions. (The old right-hand "Cook plan" box held a broken
 *      empty-state; the design's cook-rhythm card that replaces it needs
 *      a steps model that doesn't exist yet, so it's deferred.)
 *   2. Dishes section — sectionLabel + decorative "Drag to reorder"
 *      hint + Card with dish rows. Each row has a `::` drag handle
 *      (decorative — reorder logic deferred), 56×56 MealTile, name,
 *      meta line, Open recipe button, Edit pencil.
 *   3. Bottom split — Combined shopping placeholder (left) + Cooks
 *      invited list from `households.current` members (right).
 *
 * Dynamic breadcrumb: `useSetBreadcrumb(plan.name)` replaces the
 * static "Plan" crumb in the TopBar with the actual plan name.
 *
 * Reorder deferral: the `::` handle is visual only. R24's mobile
 * round documented the same deferral; the `plans.reorderDishes`
 * procedure stays unused on both platforms until the drag-and-drop
 * implementation lands.
 *
 * Combined shopping: aggregated from the dishes' structured
 * `meal_ingredients` (with a legacy `ingredients[]` fallback) via
 * `getPlanShoppingList`; locked dishes are excluded.
 *
 * Cooks invited: read members from `households.current`. Generic
 * "Owner" / "Cook" role labels — per-plan role assignment is not a
 * schema feature today.
 */

export type PlanDetailDish = {
  id: string;
  mealId: string;
  mealName: string;
  mealPhotoUrl: string | null;
  sortOrder: number;
  actualEffort: "quick" | "easy" | "medium" | "high_effort" | null;
  timeTakenMinutes: number | null;
  verdict: "repeat" | "modify" | "do_not_repeat" | null;
  annotationNotes: string | null;
  /** Who added the dish to the plan — the dish's "lead" cook in the meta. */
  addedByName: string | null;
  /** Co-cook lacks this dish's recipe → render a locked, requestable row. */
  locked: boolean;
};

export type PlanDetailPlan = {
  id: string;
  name: string;
  scheduledDate: string;
  notes: string | null;
  archivedAt: Date | string | null;
};

export type PlanDetailMember = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
};

export type PlanDetailLibraryRow = {
  id: string;
  name: string;
  photoUrl: string | null;
};

const EFFORT_LABEL: Record<
  "quick" | "easy" | "medium" | "high_effort",
  string
> = {
  quick: "quick",
  easy: "easy",
  medium: "medium",
  high_effort: "high effort"
};

export function PlanDetailClient({
  plan,
  canEdit,
  canManageSharing,
  ownerName,
  dishes,
  hiddenDishCount,
  members,
  shoppingList,
  library
}: {
  plan: PlanDetailPlan;
  /** Viewer owns this plan. Accepted for call-site compatibility; sharing
   *  controls now gate on `canManageSharing`. */
  isOwner?: boolean;
  /** Viewer can edit the plan in place (owner/admin/editor) — gates add-dish,
   *  reorder, annotation editing. */
  canEdit: boolean;
  /** Viewer can manage who has access (owner/admin) — gates the share strip. */
  canManageSharing: boolean;
  /** Plan owner's name — for the grantee (co-cook) strip variant. */
  ownerName: string | null;
  dishes: PlanDetailDish[];
  /**
   * R32 — count of dishes on this plan that were filtered out because
   * the underlying meal is another member's personal recipe. Rendered
   * as a mono-caps placeholder row so non-creators see "N dishes
   * hidden by other members" rather than a mysteriously-shorter list.
   * Always zero when the viewer is the plan's creator and any
   * personal dishes on the plan are theirs.
   */
  hiddenDishCount: number;
  members: PlanDetailMember[];
  /** Deduped ingredient names across the plan's accessible dishes. */
  shoppingList: string[];
  library: PlanDetailLibraryRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  useSetBreadcrumb(plan.name);

  const isArchived = Boolean(plan.archivedAt);

  // TopBar action: Edit plan. The R28 spec also called for an "Add
  // dish" forest button, but the existing `<AddDishPicker>` is a
  // self-contained `<Dialog>` with its own trigger button — we can't
  // open it from outside without refactoring its API. Compromise:
  // render `<AddDishPicker>` inline beneath the dishes list (its
  // native trigger button doubles as the dashed "Add a dish" CTA),
  // and skip the TopBar Add-dish entry. Edit plan stays.
  const [editingPlan, setEditingPlan] = React.useState(false);

  const archiveMutation = trpc.plans.archive.useMutation();
  const unarchiveMutation = trpc.plans.unarchive.useMutation();

  const dateLabel = (() => {
    try {
      return format(parseISO(plan.scheduledDate), "EEE, MMM d, yyyy");
    } catch {
      return plan.scheduledDate;
    }
  })();

  const sortedDishes = React.useMemo(
    () => dishes.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [dishes]
  );

  const existingMealIds = React.useMemo(
    () => sortedDishes.map((d) => d.mealId),
    [sortedDishes]
  );

  // Drag-to-reorder. `items` is the local optimistic order; it mirrors the
  // server order on every dishes change (add/remove/refresh) and is persisted
  // via plans.reorderDishes on drop.
  const [items, setItems] = React.useState(sortedDishes);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror server order when dishes change
    setItems(sortedDishes);
  }, [sortedDishes]);
  const dragIndex = React.useRef<number | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const reorderMut = trpc.plans.reorderDishes.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => {
      setItems(sortedDishes); // revert optimistic order
      showToast({ variant: "error", title: "Couldn't reorder", description: e.message });
    }
  });

  function handleDishDrop(targetIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDraggingId(null);
    setOverIndex(null);
    if (from === null || from === targetIndex) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    reorderMut.mutate({
      planId: plan.id,
      order: { dishIdsInOrder: next.map((d) => d.id) }
    });
  }

  // Effort modal — used in the hero chip row when at least one dish
  // has actual effort recorded.
  const effortChip = React.useMemo(() => {
    if (sortedDishes.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const d of sortedDishes) {
      if (d.actualEffort) counts[d.actualEffort] = (counts[d.actualEffort] ?? 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const modal = entries[0]?.[0];
    if (!modal) return null;
    return EFFORT_LABEL[modal as keyof typeof EFFORT_LABEL];
  }, [sortedDishes]);

  async function handleArchiveToggle() {
    try {
      if (isArchived) {
        await unarchiveMutation.mutateAsync({ planId: plan.id });
        showToast({
          variant: "success",
          title: "Plan restored",
          description: `${plan.name} is back in your scheduled plans.`
        });
      } else {
        await archiveMutation.mutateAsync({ planId: plan.id });
        showToast({
          variant: "success",
          title: "Plan archived",
          description: `${plan.name} moved to drafts.`
        });
      }
      router.refresh();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Couldn't update plan",
        description: err instanceof Error ? err.message : "Try again."
      });
    }
  }

  return (
    <div className="grid gap-7">
      {/* Hero — single editorial column. (The old right-hand "Cook plan"
          box held a broken empty-state; the cook-rhythm card that replaces
          it in the design needs a steps model we don't have yet.) */}
      <section className="grid gap-3">
        <p
          className="font-mono text-[10.5px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          Plan
        </p>
        <h1
          className="font-serif text-[52px] leading-[0.98] text-foreground sm:text-[64px] lg:text-[80px]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {plan.name}.
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant="sage" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateLabel}
          </Badge>
          <Badge variant="sage">
            {sortedDishes.length} {sortedDishes.length === 1 ? "dish" : "dishes"}
          </Badge>
          {effortChip ? <Badge variant="wheat">{effortChip} overall</Badge> : null}
          {isArchived ? (
            <Badge variant="ghost" className="font-mono">
              Archived
            </Badge>
          ) : null}
        </div>
        {plan.notes ? (
          <p className="mt-1 max-w-[640px] text-[14px] leading-[1.55] text-muted-foreground">
            {plan.notes}
          </p>
        ) : null}
        {/* Primary actions live in the hero (not the top bar). */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[40px]"
            onClick={() => setEditingPlan((prev) => !prev)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {editingPlan ? "Done editing" : "Edit plan"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="min-h-[40px] text-muted-foreground"
                disabled={archiveMutation.isPending || unarchiveMutation.isPending}
              >
                {archiveMutation.isPending || unarchiveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
                {isArchived ? "Restore" : "Archive"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isArchived ? "Restore this plan?" : "Archive this plan?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isArchived
                    ? `${plan.name} moves back into your scheduled plans.`
                    : `${plan.name} moves to drafts. You can restore it anytime.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchiveToggle}>
                  {isArchived ? "Restore" : "Archive"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      {/* Inline plan-edit form — surfaces under the hero when the
          TopBar's Edit toggle is on. Reuses the existing trpc
          updatePlan path that the R23 plan-detail used; we just
          render the form in a different shell. */}
      {editingPlan ? (
        <PlanEditForm
          plan={plan}
          onSaved={() => {
            setEditingPlan(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* "Who can see this" strip — sharing a plan shares its live
          structure, not the underlying recipes (the Share sheet copy
          spells this out). */}
      <WhoCanSeeStrip
        itemType="plan"
        itemId={plan.id}
        itemName={plan.name}
        isOwner={canManageSharing}
        ownerName={ownerName}
      />

      {/* Dishes section */}
      <section className="grid gap-3">
        <SectionLabel
          action={
            canEdit && sortedDishes.length > 1 ? (
              <span
                className="font-mono text-[10.5px] uppercase text-muted-foreground opacity-70"
                style={{ letterSpacing: "0.14em" }}
                aria-hidden
              >
                Drag to reorder
              </span>
            ) : null
          }
        >
          Dishes
        </SectionLabel>
        <Card className="overflow-hidden p-0">
          {items.length > 0 ? (
            <ul className="grid divide-y divide-[var(--border-soft,var(--border))]">
              {items.map((dish, i) => {
                const draggable = canEdit && items.length > 1;
                return (
                  <li
                    key={dish.id}
                    onDragOver={(e) => {
                      if (dragIndex.current !== null) {
                        e.preventDefault();
                        setOverIndex(i);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDishDrop(i);
                    }}
                    className={cn(
                      "transition-colors",
                      draggingId === dish.id && "opacity-50",
                      overIndex === i &&
                        draggingId &&
                        draggingId !== dish.id &&
                        "bg-[var(--surface-2)]"
                    )}
                  >
                    <DishRow
                      planDishId={dish.id}
                      dish={dish}
                      canEdit={canEdit}
                      dragHandle={
                        draggable
                          ? {
                              onDragStart: () => {
                                dragIndex.current = i;
                                setDraggingId(dish.id);
                              },
                              onDragEnd: () => {
                                dragIndex.current = null;
                                setDraggingId(null);
                                setOverIndex(null);
                              }
                            }
                          : undefined
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-[18px] py-6 text-center">
              <p className="text-[13.5px] text-muted-foreground">
                No dishes yet. Tap <em>Add dish</em> above to pull from
                your library.
              </p>
            </div>
          )}
          {/* R32 — hidden-dishes placeholder. When the viewer is not
              the creator of a personal dish on the plan, the service
              filtered it out + bumped this count. We surface a single
              mono-caps row so the missing rows don't look like a
              data bug. */}
          {hiddenDishCount > 0 ? (
            <div className="border-t border-[var(--border-soft,var(--border))] px-[18px] py-3">
              <p
                className="font-mono text-[10.5px] uppercase text-muted-foreground"
                style={{ letterSpacing: "0.14em" }}
              >
                {hiddenDishCount === 1
                  ? "1 dish hidden by another member"
                  : `${hiddenDishCount} dishes hidden by other members`}
              </p>
            </div>
          ) : null}
          {/* Add-dish is an edit affordance — owner/admin/editor only. */}
          {canEdit ? (
            <div className="border-t border-[var(--border-soft,var(--border))] p-3">
              {/* Full-width dashed "add a dish" row — the AddDishPicker's
                  trigger styled to span the card. */}
              <AddDishPicker
                planId={plan.id}
                library={library}
                existingMealIds={existingMealIds}
                triggerLabel="Add a dish from your library"
                triggerClassName="h-11 w-full justify-center rounded-[10px] border-dashed border-[var(--border-strong,var(--border))] bg-transparent text-[13.5px] font-medium text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground"
              />
            </div>
          ) : null}
        </Card>
      </section>

      {/* Bottom split — Combined shopping (placeholder) + Cooks invited */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-start justify-between gap-3">
            <SectionLabel>Combined shopping</SectionLabel>
            {(() => {
              const n = sortedDishes.filter((d) => !d.locked).length;
              return n > 0 ? (
                <Badge variant="sage">
                  Across {n} {n === 1 ? "dish" : "dishes"}
                </Badge>
              ) : null;
            })()}
          </div>
          {shoppingList.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {shoppingList.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--border-soft,var(--border))] bg-[var(--paper,var(--surface-2))] px-[11px] py-[6px] text-[12.5px] text-[color:var(--ink-2,var(--muted-foreground))]"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13px] italic text-muted-foreground">
              Add ingredients to this plan&apos;s dishes and they&apos;ll aggregate into one
              shopping list here.
            </p>
          )}
        </Card>

        <Card className="p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <SectionLabel>Cooks invited</SectionLabel>
          {members.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {members.map((member, idx) => (
                <CookRow key={member.userId} member={member} index={idx} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] italic text-muted-foreground">
              Just you for now.
            </p>
          )}
          <p
            className="mt-4 font-mono text-[10px] uppercase text-muted-foreground opacity-70"
            style={{ letterSpacing: "0.14em" }}
          >
            Per-plan roles · coming soon
          </p>
        </Card>
      </section>

    </div>
  );
}

function DishRow({
  planDishId,
  dish,
  canEdit,
  dragHandle
}: {
  planDishId: string;
  dish: PlanDetailDish;
  /** Owner/admin/editor — gates the annotation (cook's-notes) editor. */
  canEdit: boolean;
  /** When set, the grip becomes a native drag handle for reordering. */
  dragHandle?: { onDragStart: () => void; onDragEnd: () => void };
}) {
  const { showToast } = useToast();
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [requested, setRequested] = React.useState(false);
  const requestMut = trpc.sharing.request.useMutation({
    onSuccess: () => {
      setRequested(true);
      showToast({ variant: "success", title: "Recipe requested" });
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't request", description: e.message })
  });

  // Locked dish — a co-cook who lacks this recipe. Show a requestable row
  // instead of a working recipe link.
  if (dish.locked) {
    return (
      <div className="mx-[18px] my-2 flex flex-wrap items-center gap-3 rounded-[12px] border border-dashed border-[var(--border-strong,var(--border))] bg-[var(--paper,var(--surface-2))] px-3 py-3">
        <span className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-md bg-[var(--border-soft,var(--surface-2))] text-muted-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-[var(--ink-2,var(--muted-foreground))]">
            {dish.mealName}
          </p>
          <p
            className="mt-0.5 flex items-center gap-1 font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.13em" }}
          >
            <Lock className="h-3 w-3" />
            Recipe not shared with you
          </p>
        </div>
        {requested ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            Requested
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[36px] text-[color:var(--primary)]"
            disabled={requestMut.isPending}
            onClick={() => requestMut.mutate({ itemType: "recipe", itemId: dish.mealId })}
          >
            Request recipe
          </Button>
        )}
      </div>
    );
  }

  const metaParts: string[] = [];
  if (dish.actualEffort) metaParts.push(EFFORT_LABEL[dish.actualEffort]);
  if (dish.timeTakenMinutes) metaParts.push(`${dish.timeTakenMinutes} min`);
  if (dish.verdict) {
    const verdictLabel = {
      repeat: "would repeat",
      modify: "would modify",
      do_not_repeat: "won't repeat"
    }[dish.verdict];
    metaParts.push(verdictLabel);
  }
  // The dish "lead" — who added it to the plan.
  if (dish.addedByName?.trim()) metaParts.push(dish.addedByName.trim());
  const meta = metaParts.length > 0 ? metaParts.join(" · ") : null;

  return (
    <div className="grid gap-2 px-[18px] py-3">
      <div className="flex items-center gap-3">
        <span
          draggable={!!dragHandle}
          onDragStart={dragHandle?.onDragStart}
          onDragEnd={dragHandle?.onDragEnd}
          className={cn(
            "text-[var(--ink-4,var(--border-strong))] opacity-70",
            dragHandle && "cursor-grab active:cursor-grabbing"
          )}
          title={dragHandle ? "Drag to reorder" : undefined}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="h-[56px] w-[56px] shrink-0">
          {dish.mealPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dish.mealPhotoUrl}
              alt=""
              className="h-full w-full rounded-md border bg-muted object-cover"
            />
          ) : (
            <MealTile name={dish.mealName} size="m" className="h-full w-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-foreground">
            {dish.mealName}
          </p>
          {meta ? (
            <p
              className="mt-0.5 font-mono text-[10.5px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.13em" }}
            >
              {meta}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm" className="min-h-[36px]">
            <Link href={`/meal/${dish.mealId}` as Route}>
              Open recipe
            </Link>
          </Button>
          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 px-0"
              onClick={() => setEditingNotes((prev) => !prev)}
              aria-label={editingNotes ? "Close annotation editor" : "Edit annotation"}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {dish.annotationNotes ? (
        <p
          className={cn(
            "ml-[80px] max-w-[640px] text-[13.5px] italic leading-[1.5] text-muted-foreground",
            editingNotes ? "" : ""
          )}
        >
          {dish.annotationNotes}
        </p>
      ) : null}
      {editingNotes ? (
        <div className="ml-[80px]">
          <AnnotationEditor
            planDishId={planDishId}
            initial={{
              actualEffort: dish.actualEffort,
              timeTakenMinutes: dish.timeTakenMinutes,
              verdict: dish.verdict,
              annotationNotes: dish.annotationNotes
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function CookRow({
  member,
  index
}: {
  member: PlanDetailMember;
  index: number;
}) {
  const displayName = member.name?.trim() || member.email.split("@")[0];
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();
  // Alternate sage/wheat for visual variety on small lists.
  const palette = index % 2 === 0
    ? "bg-[color:var(--sage)] text-[color:var(--sage-fg)]"
    : "bg-[color:var(--wheat)] text-[color:var(--wheat-fg)]";
  const roleLabel = member.role === "owner" ? "Owner" : "Cook";
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-serif italic",
          palette
        )}
        style={{ letterSpacing: "-0.02em" }}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-foreground">
          {displayName}
        </p>
        <p
          className="font-mono text-[10.5px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.13em" }}
        >
          {roleLabel}
        </p>
      </div>
    </li>
  );
}

/**
 * Inline plan-edit form. Wraps the existing tRPC `plans.update`
 * mutation so the user can rename the plan or update its notes
 * without leaving the page. The R23 plan-detail had a similar inline
 * editor; this is a slimmed-down version.
 */
function PlanEditForm({
  plan,
  onSaved
}: {
  plan: PlanDetailPlan;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const updatePlan = trpc.plans.update.useMutation();
  const [name, setName] = React.useState(plan.name);
  const [notes, setNotes] = React.useState(plan.notes ?? "");
  const [scheduledDate, setScheduledDate] = React.useState(plan.scheduledDate);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePlan.mutateAsync({
        planId: plan.id,
        patch: {
          name: name.trim(),
          notes: notes.trim() ? notes.trim() : "",
          scheduledDate
        }
      });
      showToast({ variant: "success", title: "Plan saved" });
      onSaved();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Couldn't save plan",
        description: err instanceof Error ? err.message : "Try again."
      });
    }
  }

  return (
    <Card className="p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <form onSubmit={handleSave} className="grid gap-3">
        <SectionLabel>Edit plan</SectionLabel>
        <div className="grid gap-2">
          <label className="text-[12.5px] font-medium text-foreground">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-[var(--surface)] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[12.5px] font-medium text-foreground">
            Scheduled date
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-[var(--surface)] px-3 py-2 text-[14px]"
            />
          </label>
          <label className="text-[12.5px] font-medium text-foreground">
            Cook notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border bg-[var(--surface)] px-3 py-2 text-[14px] leading-[1.55]"
              placeholder="Rhythm of the day — who's starting prep when, what to brief the cooks on."
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="default"
            className="min-h-[40px]"
            disabled={updatePlan.isPending}
          >
            {updatePlan.isPending ? "Saving…" : "Save plan"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[40px]"
            onClick={onSaved}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

