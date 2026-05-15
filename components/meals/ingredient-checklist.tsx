"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Round 10 — interactive "have / need" checklist on `/meal/[id]`.
 *
 * State is intentionally session-local (plain `useState`, not persisted).
 * The user flow is "open the recipe → tap what's already in the kitchen
 * → see what to buy" — a single sweep, usually inside one tab. Surviving
 * a refresh would be surprising in either direction (the wife in the
 * store would expect a fresh list every time she opens biryani; the
 * cook at home would expect the same). When that complaint actually
 * arrives, hoist to localStorage; until then, simpler is better.
 *
 * The empty-state "Extract ingredients with AI" button lands in Task 5
 * alongside the action it triggers.
 *
 * Round 10 / Task 4: Copy + WhatsApp export hang off the summary block
 * whenever there are unchecked items. The `needed` subset feeds both
 * exports; no separate state plumbing.
 */
export function IngredientChecklist({
  ingredients,
  mealName,
  mealId,
  canExtract
}: {
  ingredients: string[] | null;
  mealName: string;
  mealId: string;
  /**
   * True when the meal has `recipeText` worth feeding to the AI. The
   * "Extract ingredients with AI" button only renders when this is
   * true — for meals with no recipe text, the AI has nothing to read
   * and the action would just return NO_RECIPE_TEXT.
   */
  canExtract: boolean;
}) {
  if (!ingredients || ingredients.length === 0) {
    return <IngredientChecklistEmpty mealId={mealId} canExtract={canExtract} />;
  }

  return <IngredientChecklistBody ingredients={ingredients} mealName={mealName} />;
}

/**
 * Empty-state surface. Renders the "No ingredients yet" copy and, when
 * the meal has a recipeText we can extract from, a button that fires
 * the action. Errors map to toasts; success path triggers
 * `router.refresh()` so the server-rendered prop refills with the
 * persisted list. Avoiding a local optimistic state keeps the
 * checklist single-sourced from the server.
 */
function IngredientChecklistEmpty({
  mealId,
  canExtract
}: {
  mealId: string;
  canExtract: boolean;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const extractMutation = trpc.ai.extractIngredientsForMeal.useMutation();

  async function handleExtract() {
    try {
      const result = await extractMutation.mutateAsync({ mealId });
      if (result.ingredients.length === 0) {
        showToast({
          variant: "info",
          title: "No ingredients found",
          description:
            "The AI couldn't pick out an ingredient list from this recipe. You can edit the recipe and try again."
        });
        return;
      }
      showToast({
        variant: "success",
        title: `Extracted ${result.ingredients.length} ingredient${
          result.ingredients.length === 1 ? "" : "s"
        }`
      });
      router.refresh();
    } catch (error) {
      const cause = getCause(error);
      const reason = cause?.reason;
      const message =
        error instanceof Error ? error.message : "Please try again.";
      if (reason === "UPGRADE_REQUIRED") {
        showToast({
          variant: "error",
          title: "Upgrade required",
          description: message ?? "Extracting ingredients is a paid-tier feature."
        });
      } else if (reason === "RATE_LIMITED") {
        showToast({
          variant: "error",
          title: "Daily AI limit reached",
          description: message ?? "Try again tomorrow."
        });
      } else if (reason === "NO_RECIPE_TEXT") {
        showToast({
          variant: "info",
          title: "Nothing to extract",
          description:
            "Add a recipe to this meal first, then try extracting ingredients."
        });
      } else if (reason === "NOT_FOUND") {
        showToast({
          variant: "error",
          title: "Meal not found",
          description: message
        });
      } else {
        showToast({
          variant: "error",
          title: "Extraction failed",
          description: message
        });
      }
    }
  }
  const isPending = extractMutation.isPending;

  return (
    <div className="grid gap-2.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4">
      <p className="text-sm text-muted-foreground">
        No ingredients listed for this recipe yet.
      </p>
      {canExtract ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExtract}
            disabled={isPending}
            className="min-h-[40px]"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isPending ? "Extracting…" : "Extract ingredients with AI"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function IngredientChecklistBody({
  ingredients,
  mealName
}: {
  ingredients: string[];
  mealName: string;
}) {
  // Track checked state by index. Using index (not the line text) lets
  // duplicates like "1 tsp salt" / "1 tsp salt (for tempering)" toggle
  // independently. The order/identity of `ingredients` is server-set
  // and stable for the page's lifetime — duplicating a render with
  // different props is not a case we handle here.
  const [checked, setChecked] = React.useState<ReadonlySet<number>>(
    () => new Set()
  );

  const toggle = React.useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const needed = ingredients
    .map((line, idx) => ({ line, idx }))
    .filter(({ idx }) => !checked.has(idx));

  const allChecked = needed.length === 0;
  const noneChecked = checked.size === 0;

  return (
    <div className="grid gap-3">
      <ul className="grid gap-0.5">
        {ingredients.map((line, idx) => {
          const isChecked = checked.has(idx);
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-pressed={isChecked}
                aria-label={
                  isChecked
                    ? `Mark "${line}" as needed`
                    : `Mark "${line}" as on hand`
                }
                // Min-height 44px hits Apple HIG touch-target guidance —
                // the wife is using this with one thumb at Meijer.
                className="-mx-1 flex w-full min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-[var(--border-strong,#cfccc0)] bg-transparent"
                  )}
                >
                  {isChecked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <span
                  className={cn(
                    "text-[15px] leading-[1.4] transition-colors",
                    isChecked
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {line}
                </span>
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
 * Summary block — three states correspond to checklist progress:
 *   1. Nothing checked: prompt the user toward the interaction.
 *      Export buttons still render because the "need" list is the
 *      whole recipe in this state — a valid shopping-list shape.
 *   2. Some checked: surface the gap as a real shopping list +
 *      Copy / WhatsApp exports.
 *   3. All checked: confirm "you have everything," hide exports
 *      (there'd be nothing to send).
 */
function ChecklistSummary({
  needed,
  allChecked,
  noneChecked,
  mealName
}: {
  needed: { line: string; idx: number }[];
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

  const needLines = needed.map((n) => n.line);

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
          {needed.map(({ line, idx }) => (
            <li key={idx} className="text-[13.5px] leading-[1.4] text-foreground">
              · {line}
            </li>
          ))}
        </ul>
      </div>
      <ShoppingListExport mealName={mealName} lines={needLines} />
    </div>
  );
}

/**
 * Builds the shopping-list text and exposes Copy + WhatsApp buttons.
 * Same canonical format flows to both surfaces so the user sees the
 * exact same text in either path — no translation surprises between
 * pasting and forwarding.
 *
 *   Shopping list for [Recipe Name]:
 *   - Ingredient 1
 *   - Ingredient 2
 *
 * `wa.me/?text=...` is the documented WhatsApp deep link; works in the
 * app on mobile and Web on desktop. Buttons are equal-weight outline
 * variants so neither dominates the visual hierarchy.
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
      // Trailing newline is intentional — pastes into Notes / iMessage
      // with a clean end-of-message break.
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
      // Permissions can block writeText in private mode, iframes, and
      // some embedded webviews. Surface a recoverable hint instead of
      // failing silently.
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
        // 44px min-height = Apple HIG touch target. The cooked-by-thumb
        // moment is the whole point of this surface.
        className="min-h-[44px]"
      >
        <Clipboard className="h-4 w-4" />
        {justCopied ? "Copied!" : "Copy list"}
      </Button>
      <Button
        type="button"
        variant="outline"
        asChild
        className="min-h-[44px]"
      >
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      </Button>
    </div>
  );
}
