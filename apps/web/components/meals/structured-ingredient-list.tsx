"use client";

import * as React from "react";
import { Check, Clipboard, MessageCircle } from "lucide-react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Round 25 — structured ingredient renderer for the recipe view.
 *
 * Parallel to the legacy `IngredientChecklist`, not a refactor.
 * The page picks one or the other based on whether
 * `meal.structuredIngredients.length > 0`. The legacy component still
 * carries every meal that predates the R18 Refine save path.
 *
 * Visual contract (mirrors the mobile structured row layout from
 * `apps/mobile/app/(authed)/meal/[id]/index.tsx` lines 437–483):
 *
 *   [checkbox]  Cumin seeds, finely ground          2 tsp
 *               ^^^^^^^^^^^^^^                      ^^^^^^^
 *               name (sans, ink)                    qty (mono, muted, right)
 *               + italic prep note inline below
 *
 * Checkbox state is session-local — matches `IngredientChecklist`'s
 * deliberate non-persistence (R10 comment: "open the recipe → tap what's
 * already in the kitchen → see what to buy"; surviving a refresh would
 * be surprising). The Has/Need summary block at the bottom of the
 * legacy component is preserved here too, including the same
 * Copy / WhatsApp export buttons. Exports flatten structured rows into
 * single-line strings via `formatStructuredIngredientForExport` so the
 * downstream copy/share text stays identical to what the page renders.
 */

export type StructuredIngredient = {
  id: string;
  position: number;
  name: string;
  quantityString: string;
  prepNote: string | null;
};

/**
 * Flatten one structured row into the single-string shape used for
 * exports (WhatsApp + Copy) and for any consumer that needs a plain
 * line. Kept here rather than in a separate helper module so the
 * shape stays colocated with the consumer that owns the visual
 * contract.
 *
 * Example: `{ name: "salt", quantityString: "2 tsp", prepNote: "fine" }`
 *   → `"2 tsp salt (fine)"`
 *
 * Edge cases:
 *   - empty quantityString  → "<name>" (+ note)
 *   - no prepNote           → "<qty> <name>"
 *   - empty name (shouldn't happen, but guard) → falls back to "ingredient"
 */
export function formatStructuredIngredientForExport(
  ingredient: StructuredIngredient
): string {
  const name = ingredient.name.trim() || "ingredient";
  const qty = ingredient.quantityString.trim();
  const note = ingredient.prepNote?.trim();
  const head = qty ? `${qty} ${name}` : name;
  return note ? `${head} (${note})` : head;
}

export function StructuredIngredientList({
  ingredients,
  mealName
}: {
  ingredients: StructuredIngredient[];
  mealName: string;
}) {
  // Sort by position once — the server returns ordered rows, but the
  // legacy table allows manual edits to land out-of-order, so we
  // resort defensively. Cheap on lists of typical size (~20 items).
  const sorted = React.useMemo(
    () => ingredients.slice().sort((a, b) => a.position - b.position),
    [ingredients]
  );

  // Track checked state by id — stable across reorders (unlike index,
  // which the legacy checklist uses to handle duplicates). Structured
  // rows have stable ids, so id-keying is safe and survives a
  // hypothetical mid-session refetch better than index-keying would.
  const [checked, setChecked] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );

  const toggle = React.useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const needed = sorted.filter((row) => !checked.has(row.id));
  const allChecked = needed.length === 0 && sorted.length > 0;
  const noneChecked = checked.size === 0;

  return (
    <div className="grid gap-3">
      <ul className="grid gap-0.5">
        {sorted.map((row) => {
          const isChecked = checked.has(row.id);
          const note = row.prepNote?.trim();
          const qty = row.quantityString.trim();
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => toggle(row.id)}
                aria-pressed={isChecked}
                aria-label={
                  isChecked
                    ? `Mark "${row.name}" as needed`
                    : `Mark "${row.name}" as on hand`
                }
                // 44px min-height for touch targets — same Apple HIG
                // rationale as the legacy checklist. The grid layout
                // keeps the qty column right-aligned regardless of
                // name length.
                className="-mx-1 grid w-full min-h-[44px] cursor-pointer grid-cols-[22px_1fr_auto] items-start gap-3 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-[var(--border-strong,#cfccc0)] bg-transparent"
                  )}
                >
                  {isChecked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[15px] leading-[1.4] transition-colors",
                      isChecked
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                  >
                    {row.name}
                  </span>
                  {note ? (
                    // Prep notes ("finely chopped", "at room temp") use
                    // the same serif-italic muted treatment as the
                    // mobile pattern — sets them apart from the name
                    // without weighing them down.
                    <span
                      className={cn(
                        "block font-serif text-[13px] italic leading-[1.35] text-muted-foreground transition-colors",
                        isChecked ? "line-through" : ""
                      )}
                    >
                      {note}
                    </span>
                  ) : null}
                </span>
                {qty ? (
                  <span
                    className={cn(
                      "mt-[3px] whitespace-nowrap text-right font-mono text-[12.5px] uppercase text-muted-foreground transition-colors",
                      isChecked ? "line-through opacity-60" : ""
                    )}
                    style={{ letterSpacing: "0.04em" }}
                  >
                    {qty}
                  </span>
                ) : (
                  // Reserve grid column so the row's name + note still
                  // align with rows that have qty. Empty span keeps
                  // the grid track intact.
                  <span aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <ChecklistSummary
        needed={needed}
        allChecked={allChecked}
        noneChecked={noneChecked}
        mealName={mealName}
      />
    </div>
  );
}

/**
 * Same three-state summary as the legacy `ChecklistSummary`. Re-implemented
 * here rather than imported because the legacy component scopes it to
 * file-local — copying keeps both components independent and avoids a
 * cross-import that would couple their lifecycles. The Copy / WhatsApp
 * export shape is identical so consumers see no behavioral change when
 * a meal flips from legacy to structured rendering.
 */
function ChecklistSummary({
  needed,
  allChecked,
  noneChecked,
  mealName
}: {
  needed: StructuredIngredient[];
  allChecked: boolean;
  noneChecked: boolean;
  mealName: string;
}) {
  if (allChecked) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-[13.5px] text-primary">
        You have everything for this recipe.
      </div>
    );
  }

  const needLines = needed.map(formatStructuredIngredientForExport);

  if (noneChecked) {
    return (
      <div className="grid gap-2.5">
        <p className="text-[13px] italic text-muted-foreground">
          Tap each ingredient you have to build a shopping list.
        </p>
        <ShoppingListExport mealName={mealName} lines={needLines} />
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      <div className="grid gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
        <p className="text-[13px] font-medium text-foreground">
          You need {needed.length} thing{needed.length === 1 ? "" : "s"}:
        </p>
        <ul className="grid gap-0.5 pl-1">
          {needed.map((row) => (
            <li
              key={row.id}
              className="text-[13.5px] leading-[1.4] text-foreground"
            >
              · {formatStructuredIngredientForExport(row)}
            </li>
          ))}
        </ul>
      </div>
      <ShoppingListExport mealName={mealName} lines={needLines} />
    </div>
  );
}

/**
 * Same export contract as the legacy checklist's `ShoppingListExport`.
 * `wa.me/?text=...` opens the WhatsApp deep link; clipboard fallback
 * matches the legacy toast copy. Re-implemented per the "parallel
 * component" approach so neither file imports the other.
 */
function ShoppingListExport({
  mealName,
  lines
}: {
  mealName: string;
  lines: string[];
}) {
  const { showToast } = useToast();
  const [justCopied, setJustCopied] = React.useState(false);

  const shoppingListText = React.useMemo(
    () =>
      `Shopping list for ${mealName}:\n${lines.map((l) => `- ${l}`).join("\n")}\n`,
    [mealName, lines]
  );

  const whatsappHref = React.useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(shoppingListText)}`,
    [shoppingListText]
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shoppingListText);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), 1800);
      showToast({
        variant: "success",
        title: "Shopping list copied",
        description: `${lines.length} ingredient${lines.length === 1 ? "" : "s"}.`
      });
    } catch {
      showToast({
        variant: "error",
        title: "Couldn't copy",
        description: "Long-press the list above to copy manually."
      });
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className="min-h-[44px]"
      >
        <Clipboard className="h-4 w-4" />
        {justCopied ? "Copied!" : "Copy list"}
      </Button>
      <Button type="button" variant="outline" asChild className="min-h-[44px]">
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      </Button>
    </div>
  );
}
