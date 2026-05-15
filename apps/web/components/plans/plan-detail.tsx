"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Copy,
  Loader2,
  Pencil,
  Trash2,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { MealThumb } from "@/components/dashboard/meal-thumb";
import { useToast } from "@/components/providers/toast-provider";
import { PlanForm } from "@/components/plans/plan-form";
import { AddDishPicker } from "@/components/plans/add-dish-picker";
import { AnnotationEditor } from "@/components/plans/annotation-editor";
import { ClonePlanDialog } from "@/components/plans/clone-plan-dialog";
import { EffortAggregateChip } from "@/components/plans/effort-aggregate-chip";
import { HintBadge, type HintData } from "@/components/plans/hint-badge";
import { ShareButton } from "@/components/shares/share-button";
import { trpc } from "@/lib/trpc/client";

export type PlanDetailDish = {
  id: string;
  mealId: string;
  mealName: string;
  mealPhotoUrl: string | null;
  sortOrder: number;
  // Annotation surfaces (Task 5 expands the editor; row summary shows verdict).
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
  archivedAt: Date | null;
};

type PlanDetailProps = {
  plan: PlanDetailPlan;
  dishes: PlanDetailDish[];
  library: { id: string; name: string; photoUrl: string | null }[];
  /**
   * Hint badges rendered per dish-row when present. Keyed by mealId; the
   * value is whatever annotation the source plan captured. Server-rendered
   * from `?hintsFrom=<sourcePlanId>` so refreshing the post-clone URL
   * keeps the hints visible.
   */
  hints?: Record<string, HintData>;
  /**
   * Effort breakdown for the header chip. Computed server-side in
   * services/plans:getPlanEffortAggregate (fall-back to most-recent
   * meal-log effort when actual is null).
   */
  effortAggregate: {
    quick: number;
    easy: number;
    medium: number;
    high_effort: number;
    unrated: number;
  };
};

export function PlanDetail({
  plan,
  dishes,
  library,
  hints,
  effortAggregate
}: PlanDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [reorderingId, setReorderingId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [archivePending, setArchivePending] = React.useState(false);
  const [cloneOpen, setCloneOpen] = React.useState(false);

  const reorderMutation = trpc.plans.reorderDishes.useMutation();
  const removeDishMutation = trpc.plans.removeDish.useMutation();
  const archiveMutation = trpc.plans.archive.useMutation();
  const unarchiveMutation = trpc.plans.unarchive.useMutation();

  const hasHints = hints && Object.keys(hints).length > 0;

  function dismissHints() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("hintsFrom");
    const query = sp.toString();
    router.replace(`/plans/${plan.id}${query ? `?${query}` : ""}` as Route);
  }

  // Server is authoritative — we don't keep a local copy. Reorder uses
  // the dish ids from the prop and lets router.refresh() repaint after
  // the action commits. Brief settling between click and refresh is
  // acceptable for v1; a true optimistic swap would need useOptimistic
  // (React 19) — flagged as a future polish.

  async function moveDish(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= dishes.length) return;
    const next = [...dishes];
    const tmp = next[index]!;
    next[index] = next[swapIndex]!;
    next[swapIndex] = tmp;

    setReorderingId(next[swapIndex]!.id);
    try {
      await reorderMutation.mutateAsync({
        planId: plan.id,
        order: { dishIdsInOrder: next.map((d) => d.id) }
      });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't reorder",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setReorderingId(null);
    }
  }

  async function removeDish(planDishId: string, mealName: string) {
    if (removingId) return;
    setRemovingId(planDishId);
    try {
      await removeDishMutation.mutateAsync({
        planId: plan.id,
        dish: { planDishId }
      });
      showToast({ variant: "success", title: `Removed "${mealName}"` });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't remove dish",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function toggleArchive() {
    if (archivePending) return;
    setArchivePending(true);
    try {
      if (plan.archivedAt) {
        await unarchiveMutation.mutateAsync({ planId: plan.id });
      } else {
        await archiveMutation.mutateAsync({ planId: plan.id });
      }
      showToast({
        variant: "success",
        title: plan.archivedAt ? "Plan restored" : "Plan archived"
      });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't update",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setArchivePending(false);
    }
  }

  const existingMealIds = dishes.map((d) => d.mealId);

  return (
    <div className="grid max-w-3xl gap-5 pb-20 md:pb-0">
      <div>
        <Link
          href={"/plans" as Route}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All plans
        </Link>
      </div>

      {editing ? (
        <section className="rounded-lg border bg-background/60 p-4">
          <PlanForm
            mode="edit"
            planId={plan.id}
            defaultValues={{
              name: plan.name,
              scheduledDate: plan.scheduledDate,
              notes: plan.notes ?? ""
            }}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </section>
      ) : (
        <header className="grid gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">{plan.name}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {format(parseISO(plan.scheduledDate), "EEE, MMM d, yyyy")}
                {plan.archivedAt ? (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    Archived
                  </Badge>
                ) : null}
              </p>
              <div className="mt-2">
                <EffortAggregateChip aggregate={effortAggregate} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCloneOpen(true)}
              >
                <Copy className="h-4 w-4" />
                Clone for next time
              </Button>
            </div>
          </div>
          {plan.notes ? (
            <p className="rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              {plan.notes}
            </p>
          ) : null}
        </header>
      )}

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Dishes ({dishes.length})
          </h2>
          <AddDishPicker
            planId={plan.id}
            library={library}
            existingMealIds={existingMealIds}
          />
        </div>

        {hasHints ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Showing hints from last time — keep, modify, or remove any dish
              freely. Annotations stay empty until you add new ones.
            </span>
            <button
              type="button"
              onClick={dismissHints}
              className="inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline"
            >
              <X className="h-3 w-3" />
              Dismiss hints
            </button>
          </div>
        ) : null}

        {dishes.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
            No dishes yet. Add something from your recipe library.
          </p>
        ) : (
          <ul className="grid gap-2">
            {dishes.map((dish, idx) => {
              const isReordering = reorderingId === dish.id;
              const isRemoving = removingId === dish.id;
              return (
                <li
                  key={dish.id}
                  className="grid grid-cols-[44px_1fr_auto] items-start gap-3 rounded-lg border bg-background/60 p-3"
                >
                  <MealThumb
                    photoUrl={dish.mealPhotoUrl}
                    mealName={dish.mealName}
                    fallbackIndex={idx}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/meal/${dish.mealId}` as Route}
                        className="truncate text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {dish.mealName}
                      </Link>
                      {hints?.[dish.mealId] ? (
                        <HintBadge hint={hints[dish.mealId]!} />
                      ) : null}
                    </div>
                    {summarizeAnnotation(dish) ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {summarizeAnnotation(dish)}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <AnnotationEditor
                        key={`${dish.id}:${dish.actualEffort}:${dish.timeTakenMinutes}:${dish.verdict}:${dish.annotationNotes ?? ""}`}
                        planDishId={dish.id}
                        initial={{
                          actualEffort: dish.actualEffort,
                          timeTakenMinutes: dish.timeTakenMinutes,
                          verdict: dish.verdict,
                          annotationNotes: dish.annotationNotes
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShareButton
                      mealId={dish.mealId}
                      mealName={dish.mealName}
                      variant="icon"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveDish(idx, "up")}
                      disabled={idx === 0 || isReordering}
                      aria-label={`Move ${dish.mealName} up`}
                    >
                      {isReordering ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveDish(idx, "down")}
                      disabled={idx === dishes.length - 1 || isReordering}
                      aria-label={`Move ${dish.mealName} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isRemoving}
                          aria-label={`Remove ${dish.mealName}`}
                        >
                          {isRemoving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove {dish.mealName} from this plan?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Annotations on this dish will be lost. The recipe
                            stays in your library.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeDish(dish.id, dish.mealName)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border-t pt-5">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={archivePending}
              className="text-muted-foreground"
            >
              {archivePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : plan.archivedAt ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {plan.archivedAt ? "Restore plan" : "Archive plan"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {plan.archivedAt ? "Restore this plan?" : "Archive this plan?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {plan.archivedAt
                  ? "It'll show up in your active plans again."
                  : "You can restore it later from the archived list."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={toggleArchive}>
                {plan.archivedAt ? "Restore" : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
      <ClonePlanDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        source={{ id: plan.id, name: plan.name }}
      />
    </div>
  );
}

function summarizeAnnotation(dish: PlanDetailDish): string | null {
  const parts: string[] = [];
  if (dish.timeTakenMinutes !== null) {
    if (dish.timeTakenMinutes >= 60) {
      const h = Math.floor(dish.timeTakenMinutes / 60);
      const m = dish.timeTakenMinutes % 60;
      parts.push(m > 0 ? `Took ${h}h ${m}m` : `Took ${h}h`);
    } else {
      parts.push(`Took ${dish.timeTakenMinutes}m`);
    }
  }
  if (dish.verdict === "repeat") parts.push("Repeat");
  if (dish.verdict === "modify") parts.push("Modify");
  if (dish.verdict === "do_not_repeat") parts.push("Don't repeat");
  return parts.length > 0 ? parts.join(" · ") : null;
}
