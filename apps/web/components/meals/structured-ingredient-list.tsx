"use client";

import * as React from "react";
import { Clipboard, MessageCircle } from "lucide-react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Round 25 — structured ingredient renderer for the recipe view.
 *
 * Parallel to the legacy `IngredientChecklist`, not a refactor.
 * The page picks one or the other based on whether
 * `meal.structuredIngredients.length > 0`. The legacy component still
 * carries every meal that predates the R18 Refine save path.
 *
 * Round 27 — visual retune for the editorial Recipe Detail. Same
 * data shape, same session-local checkbox semantics, same export
 * helpers — only the visual treatment changes:
 *
 *   - Rows live inside a shadcn `<Card>` (padding 0, overflow hidden)
 *     so the whole list reads as a single object on the cream-soft
 *     ingredients sidebar.
 *   - Checkbox is a 17×17 forest-filled square (rounded-[5px]),
 *     replacing R25's rounded-full circle. Off state: 1.5px ink-4
 *     border, transparent fill. On state: forest border + fill, white
 *     checkmark.
 *   - Checked rows: ink-3 + line-through; the qty + prep note inherit
 *     the same treatment.
 *   - Each row separated by `border-top` (no border on first) instead
 *     of relying on hover-only bg.
 *
 * Export shape (`formatStructuredIngredientForExport`) and the Has /
 * Need summary block stay byte-identical so the WhatsApp + Copy text
 * users see is unchanged from R25.
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
    <div className="grid gap-4">
      <Card className="overflow-hidden p-0">
        <ul className="grid">
          {sorted.map((row, idx) => {
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
                  // rationale as the legacy checklist. First row drops
                  // the top border so the Card's edge is clean.
                  className={cn(
                    "grid w-full min-h-[44px] cursor-pointer grid-cols-[24px_1fr_auto] items-start gap-3 px-[14px] py-[10px] text-left transition-colors hover:bg-[var(--surface-2)]/60 focus:outline-none focus-visible:bg-[var(--surface-2)] focus-visible:ring-0",
                    idx > 0
                      ? "border-t border-[var(--border-soft,var(--border))]"
                      : ""
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[2px] flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
                      isChecked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-[var(--border-strong,#cfccc0)] bg-transparent"
                    )}
                  >
                    {isChecked ? (
                      // Compact 10×10 check glyph — matches the
                      // design's "10×10 SVG path" callout. Stroke kept
                      // thick so it reads at 17px box size.
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path
                          d="M1.5 5.25L4 7.75L8.5 2.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-[13.5px] font-medium leading-[1.4] transition-colors",
                        isChecked
                          ? "text-muted-foreground line-through decoration-[var(--ink-4,var(--border-strong))]"
                          : "text-foreground"
                      )}
                      style={{ letterSpacing: "-0.05px" }}
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
                          "block font-serif text-[12.5px] italic leading-[1.35] text-muted-foreground transition-colors",
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
                        "mt-[2px] whitespace-nowrap text-right font-mono text-[11.5px] uppercase text-muted-foreground transition-colors",
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
      </Card>

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
 *
 * R27 — visual swap: the WhatsApp button gains a sage tone so it
 * reads as the "primary export" against the cream-soft sidebar, with
 * Copy as the outline secondary. The export text shape is unchanged.
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
    <div className="grid gap-2">
      <Button
        type="button"
        asChild
        className="min-h-[44px] w-full bg-[var(--sage)] text-[color:var(--sage-fg)] hover:bg-[var(--sage)]/85"
      >
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          Share shopping list
        </a>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className="min-h-[44px] w-full"
      >
        <Clipboard className="h-4 w-4" />
        {justCopied ? "Copied!" : "Copy as text"}
      </Button>
    </div>
  );
}
