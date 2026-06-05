"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export type EditorIngredient = { name: string; quantityString: string; prepNote: string };
export type EditorStep = { title: string; time: string; body: string };

type IngredientRow = EditorIngredient & { _key: string };
type StepRow = EditorStep & { _key: string };

/**
 * Credit-free manual recipe editor. Edits the SAME structured tables Refine
 * writes (`meal_ingredients` / `recipe_steps`) via `meals.saveStructuredRecipe`
 * — no AI, no credits. Add / remove / reorder ingredient and step rows, then
 * Save replaces the recipe and returns to the meal.
 */
export function ManualRecipeEditor({
  mealId,
  mealName,
  initialIngredients,
  initialSteps
}: {
  mealId: string;
  mealName: string;
  initialIngredients: EditorIngredient[];
  initialSteps: EditorStep[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const save = trpc.meals.saveStructuredRecipe.useMutation();

  // Counter for keys of rows ADDED after mount. Only read in event handlers
  // (never during render) so initial keys are index-based plain values.
  const keyRef = React.useRef(0);
  const nextKey = () => `n${++keyRef.current}`;

  const [ingredients, setIngredients] = React.useState<IngredientRow[]>(() =>
    (initialIngredients.length > 0
      ? initialIngredients
      : [{ name: "", quantityString: "", prepNote: "" }]
    ).map((i, idx) => ({ ...i, _key: `i${idx}` }))
  );
  const [steps, setSteps] = React.useState<StepRow[]>(() =>
    (initialSteps.length > 0 ? initialSteps : [{ title: "", time: "", body: "" }]).map(
      (s, idx) => ({ ...s, _key: `s${idx}` })
    )
  );

  const mealHref = `/meal/${mealId}` as Route;

  function move<T>(list: T[], idx: number, dir: -1 | 1): T[] {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return list;
    const copy = list.slice();
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    return copy;
  }

  async function handleSave() {
    try {
      const result = await save.mutateAsync({
        mealId,
        ingredients: ingredients.map((i) => ({
          name: i.name,
          quantityString: i.quantityString,
          prepNote: i.prepNote || null
        })),
        steps: steps.map((s) => ({ title: s.title, time: s.time || null, body: s.body }))
      });
      await utils.meals.getById.invalidate({ mealId });
      showToast({
        variant: "success",
        title: "Recipe saved",
        description: `${result.ingredientCount} ingredient${
          result.ingredientCount === 1 ? "" : "s"
        }, ${result.stepCount} step${result.stepCount === 1 ? "" : "s"}.`
      });
      router.replace(mealHref);
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't save recipe",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <div className="mx-auto grid max-w-[760px] gap-7 px-5 py-6">
      <header className="grid gap-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Edit recipe
        </p>
        <h1 className="font-serif text-[30px] leading-tight text-foreground">{mealName}</h1>
        <p className="text-[13px] text-muted-foreground">
          Edit ingredients and steps by hand. No AI, no credits. Changes replace the saved recipe.
        </p>
      </header>

      {/* Ingredients */}
      <section className="grid gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-foreground">
          Ingredients
        </h2>
        <div className="grid gap-2">
          {ingredients.map((row, idx) => (
            <div
              key={row._key}
              className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_130px_auto]"
            >
              <Input
                aria-label="Ingredient name"
                placeholder="Ingredient (e.g. Basmati rice)"
                value={row.name}
                onChange={(e) =>
                  setIngredients((rows) =>
                    rows.map((r) => (r._key === row._key ? { ...r, name: e.target.value } : r))
                  )
                }
              />
              <Input
                aria-label="Quantity"
                placeholder="Qty (1 cup)"
                value={row.quantityString}
                onChange={(e) =>
                  setIngredients((rows) =>
                    rows.map((r) =>
                      r._key === row._key ? { ...r, quantityString: e.target.value } : r
                    )
                  )
                }
              />
              <RowControls
                onUp={() => setIngredients((rows) => move(rows, idx, -1))}
                onDown={() => setIngredients((rows) => move(rows, idx, 1))}
                onRemove={() =>
                  setIngredients((rows) =>
                    rows.length === 1
                      ? [{ name: "", quantityString: "", prepNote: "", _key: nextKey() }]
                      : rows.filter((r) => r._key !== row._key)
                  )
                }
                isFirst={idx === 0}
                isLast={idx === ingredients.length - 1}
              />
              <Input
                aria-label="Prep note"
                placeholder="Prep note (optional, e.g. finely chopped)"
                value={row.prepNote}
                className="sm:col-span-3"
                onChange={(e) =>
                  setIngredients((rows) =>
                    rows.map((r) => (r._key === row._key ? { ...r, prepNote: e.target.value } : r))
                  )
                }
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setIngredients((rows) => [
              ...rows,
              { name: "", quantityString: "", prepNote: "", _key: nextKey() }
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add ingredient
        </Button>
      </section>

      {/* Steps */}
      <section className="grid gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-foreground">Steps</h2>
        <div className="grid gap-2">
          {steps.map((row, idx) => (
            <div key={row._key} className="grid gap-2 rounded-xl border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                <Input
                  aria-label="Step title"
                  placeholder={`Step ${idx + 1} title (e.g. Sear the chicken)`}
                  value={row.title}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, title: e.target.value } : r))
                    )
                  }
                />
                <Input
                  aria-label="Step time"
                  placeholder="Time (10 min)"
                  value={row.time}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, time: e.target.value } : r))
                    )
                  }
                />
                <RowControls
                  onUp={() => setSteps((rows) => move(rows, idx, -1))}
                  onDown={() => setSteps((rows) => move(rows, idx, 1))}
                  onRemove={() =>
                    setSteps((rows) =>
                      rows.length === 1
                        ? [{ title: "", time: "", body: "", _key: nextKey() }]
                        : rows.filter((r) => r._key !== row._key)
                    )
                  }
                  isFirst={idx === 0}
                  isLast={idx === steps.length - 1}
                />
              </div>
              <Textarea
                aria-label="Step instructions"
                placeholder="What to do in this step…"
                value={row.body}
                className="min-h-[72px] resize-y text-[13px]"
                onChange={(e) =>
                  setSteps((rows) =>
                    rows.map((r) => (r._key === row._key ? { ...r, body: e.target.value } : r))
                  )
                }
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setSteps((rows) => [...rows, { title: "", time: "", body: "", _key: nextKey() }])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </section>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-5 py-3 backdrop-blur-md">
        <Button type="button" variant="ghost" onClick={() => router.push(mealHref)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save recipe
        </Button>
      </div>
    </div>
  );
}

function RowControls({
  onUp,
  onDown,
  onRemove,
  isFirst,
  isLast
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Move up" className={iconBtn} onClick={onUp} disabled={isFirst}>
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Move down"
        className={iconBtn}
        onClick={onDown}
        disabled={isLast}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Remove"
        className={cn(iconBtn, "hover:border-destructive/50 hover:text-destructive")}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
