"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { format, parseISO } from "date-fns";
import {
  ArchiveRestore,
  Edit3,
  GripVertical,
  Sparkles
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MealTile } from "@/components/ui/meal-tile";
import { SectionLabel } from "@/components/ui/section-label";

import { AddDishPicker } from "@/components/plans/add-dish-picker";
import { AnnotationEditor } from "@/components/plans/annotation-editor";
import { useSetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { useSetTopBarActions } from "@/components/layout/top-bar-actions";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

/**
 * Round 28 — editorial Plan Detail.
 *
 * Stack (top to bottom):
 *   1. Hero — left: "Plan" eyebrow + 64–80px display name + chip row
 *      (date / dish count). Right: sage-tinted "Cook plan" card with
 *      annotation/notes prompt.
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
 * Combined shopping deferral: the card renders a placeholder. A real
 * aggregation needs either N+1 dish-ingredient queries or a new
 * `plans.combinedShopping(planId)` procedure — both out of R28's
 * client-only scope. Flagged.
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
  dishes,
  hiddenDishCount,
  members,
  library
}: {
  plan: PlanDetailPlan;
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

  const topBarActions = React.useMemo(
    () => (
      <Button
        variant="outline"
        className="min-h-[40px]"
        onClick={() => setEditingPlan((prev) => !prev)}
      >
        <Edit3 className="h-3.5 w-3.5" />
        {editingPlan ? "Done editing" : "Edit plan"}
      </Button>
    ),
    [editingPlan]
  );
  useSetTopBarActions(topBarActions);

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
      {/* Hero — 1fr 320px at lg+, stacked below */}
      <section className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="grid gap-3">
          <p
            className="font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            Plan · {dateLabel}
          </p>
          <h1
            className="font-serif text-[52px] leading-[0.98] text-foreground sm:text-[64px] lg:text-[80px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {plan.name}.
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="sage">
              {sortedDishes.length}{" "}
              {sortedDishes.length === 1 ? "dish" : "dishes"}
            </Badge>
            {effortChip ? (
              <Badge variant="wheat">{effortChip}</Badge>
            ) : null}
            {isArchived ? (
              <Badge variant="ghost" className="font-mono">
                Archived
              </Badge>
            ) : null}
          </div>
        </div>

        <Card
          className="border-[color:var(--sage)] bg-[color:var(--sage-soft)] p-5"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <p
            className="font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            Cook plan
          </p>
          {plan.notes ? (
            <p className="mt-2 text-[14px] leading-[1.55] text-foreground">
              {plan.notes}
            </p>
          ) : (
            <p className="mt-2 text-[13px] italic text-muted-foreground">
              No cook notes yet. Click <em>Edit plan</em> above to add a
              rhythm — who&apos;s starting prep when, what to brief the
              cooks on.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[36px] bg-transparent"
              onClick={handleArchiveToggle}
              disabled={
                archiveMutation.isPending || unarchiveMutation.isPending
              }
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              {isArchived ? "Restore" : "Archive"}
            </Button>
          </div>
        </Card>
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

      {/* Dishes section */}
      <section className="grid gap-3">
        <SectionLabel
          action={
            sortedDishes.length > 1 ? (
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
          {sortedDishes.length > 0 ? (
            <ul className="grid divide-y divide-[var(--border-soft,var(--border))]">
              {sortedDishes.map((dish) => (
                <li key={dish.id}>
                  <DishRow planDishId={dish.id} dish={dish} />
                </li>
              ))}
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
          <div className="flex items-center justify-center border-t border-dashed border-[var(--border-strong,var(--border))] px-[18px] py-3">
            {/* AddDishPicker exports its own trigger button (Dialog
                from shadcn). Rendering it inline gives us the picker
                + the trigger in one place; the dashed-bottom row is
                its native UX. */}
            <AddDishPicker
              planId={plan.id}
              library={library}
              existingMealIds={existingMealIds}
            />
          </div>
        </Card>
      </section>

      {/* Bottom split — Combined shopping (placeholder) + Cooks invited */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-start justify-between gap-3">
            <SectionLabel>Combined shopping</SectionLabel>
            {sortedDishes.length > 0 ? (
              <Badge variant="sage">Across {sortedDishes.length} dishes</Badge>
            ) : null}
          </div>
          <p className="mt-3 text-[13px] italic text-muted-foreground">
            Shopping-list aggregation across the plan&apos;s dishes is
            coming soon. For now, open each dish individually and use its
            ingredient checklist.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className="font-mono text-[10.5px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              Aggregation pending
            </span>
          </div>
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
  dish
}: {
  planDishId: string;
  dish: PlanDetailDish;
}) {
  const [editingNotes, setEditingNotes] = React.useState(false);
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
  const meta = metaParts.length > 0 ? metaParts.join(" · ") : null;

  return (
    <div className="grid gap-2 px-[18px] py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="cursor-grab font-mono text-[18px] text-[var(--ink-4,var(--border-strong))] opacity-70"
          title="Reorder coming soon"
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
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0"
            onClick={() => setEditingNotes((prev) => !prev)}
            aria-label={editingNotes ? "Close annotation editor" : "Edit annotation"}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
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

