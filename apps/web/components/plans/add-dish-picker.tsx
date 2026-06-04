"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";

type MealLibraryItem = {
  id: string;
  name: string;
  photoUrl: string | null;
};

type AddDishPickerProps = {
  planId: string;
  library: MealLibraryItem[];
  existingMealIds: string[];
  /** Override the trigger button's label + classes (e.g. a full-width row). */
  triggerLabel?: string;
  triggerClassName?: string;
};

export function AddDishPicker({
  planId,
  library,
  existingMealIds,
  triggerLabel,
  triggerClassName
}: AddDishPickerProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [addingMealId, setAddingMealId] = React.useState<string | null>(null);
  const addDishMutation = trpc.plans.addDish.useMutation();

  // The picker only shows meals already in the household (the server fetch
  // is gated by `requireHouseholdMember` in services/plans.ts:listMealLibrary),
  // so client-side filtering is purely cosmetic.
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return library;
    return library.filter((m) => m.name.toLowerCase().includes(needle));
  }, [library, q]);

  const existingSet = React.useMemo(() => new Set(existingMealIds), [existingMealIds]);

  async function handleAdd(mealId: string, mealName: string) {
    if (addingMealId) return;
    setAddingMealId(mealId);
    try {
      await addDishMutation.mutateAsync({ planId, dish: { mealId } });
      showToast({ variant: "success", title: `Added "${mealName}"` });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't add dish",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setAddingMealId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={triggerClassName}>
          <Plus className="h-4 w-4" />
          {triggerLabel ?? "Add dish"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a dish</DialogTitle>
          <DialogDescription>
            Pick from your household&apos;s recipe library.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="grid max-h-[60vh] gap-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {library.length === 0
                ? "No recipes in your library yet. Log a meal first."
                : "No matches. Try a different search."}
            </div>
          ) : null}
          {filtered.map((meal) => {
            const isOnPlan = existingSet.has(meal.id);
            const isAdding = addingMealId === meal.id;
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => !isOnPlan && handleAdd(meal.id, meal.name)}
                disabled={isOnPlan || isAdding}
                className="flex items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {meal.name}
                </span>
                {isOnPlan ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5" />
                    On plan
                  </span>
                ) : isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
