"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealTile } from "@/components/ui/meal-tile";
import { SectionLabel } from "@/components/ui/section-label";

import { IngredientChecklist } from "@/components/meals/ingredient-checklist";
import { StepCard, type StepCardData } from "@/components/meals/step-card";
import { StructuredIngredientList } from "@/components/meals/structured-ingredient-list";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { SourceUrlEmbed } from "@/components/embeds/source-url-embed";

import { useSetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { useSetTopBarActions } from "@/components/layout/top-bar-actions";
import { splitMealName } from "@/lib/meal/split-name";
import { cn } from "@/lib/utils";

/**
 * Round 27 — editorial Recipe Detail client renderer.
 *
 * Replaces R25's utility-first two-column sticky-sidebar layout with
 * the design's two stacked full-bleed bands: a hero (square monogram
 * tile + split editorial title + chip row + meta line) above a body
 * (cream-soft ingredient sidebar + recipe steps column).
 *
 * Why this is a client component:
 *   - The R26 TopBar actions slot is populated via the
 *     `useSetTopBarActions(node)` hook, which only runs in client
 *     components. The recipe page needs to register a "Refine with AI"
 *     + "Log a cook" pair, so the rendering moves here while the
 *     surrounding page.tsx stays server-rendered (it still owns the
 *     auth gate + service fetch).
 *
 * Reuses unchanged from R25:
 *   - `<MealTile>` (palette + monogram). Square corners via
 *     `className="rounded-none"` — `cn()` uses tailwind-merge so the
 *     passed class wins over the component's internal `rounded-xl`.
 *   - `<StructuredIngredientList>` (same API, visual retune in
 *     `structured-ingredient-list.tsx`).
 *   - `<StepCard>` (same API, visual retune in `step-card.tsx`).
 *   - `<IngredientChecklist>` (legacy fallback for meals predating
 *     R18's Refine save).
 *   - Export helpers (`formatStructuredIngredientForExport` /
 *     WhatsApp / Copy buttons) ship inside StructuredIngredientList.
 *
 * Removed from R25:
 *   - `<PageTitle>` — replaced by the split-title pair (italic kicker
 *     + display headline) derived via `splitMealName(name)`.
 *   - Page-level action row (Refine / Log again / Share) — relocated
 *     to the TopBar via `useSetTopBarActions`.
 *   - The "Refresh ingredients" affordance (the
 *     `IngredientChecklist`'s `canExtract` button still exists in
 *     legacy fallback, but the user-facing rename / promotion is
 *     deferred).
 *
 * Deferred to a follow-up:
 *   - Cook mode route. The "Cook mode" link in the recipe column
 *     header is decorative (no handler) until real signal says the
 *     cook-from-screen view is a separate surface.
 *   - Dynamic breadcrumb resolution — `/meal/[id]` still reads
 *     "Recipe" in the TopBar trail.
 */

const EFFORT_BADGE_VARIANT: Record<
  "quick" | "easy" | "medium" | "high_effort",
  "sage" | "wheat" | "terra"
> = {
  quick: "sage",
  easy: "sage",
  medium: "wheat",
  high_effort: "terra"
};

const EFFORT_LABEL: Record<
  "quick" | "easy" | "medium" | "high_effort",
  string
> = {
  quick: "Quick",
  easy: "Easy",
  medium: "Medium",
  high_effort: "High effort"
};

function lastCookedLabel(lastCookedAt: string | null): string | null {
  if (!lastCookedAt) return null;
  const days = differenceInCalendarDays(new Date(), parseISO(lastCookedAt));
  if (days <= 0) return "cooked today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return format(parseISO(lastCookedAt), "MMM yyyy");
}

/**
 * Sum the per-step `time` strings into a single rolled-up label
 * ("~45 min", "~1 hr 30 min"). Mirrors the mobile pattern at
 * `apps/mobile/app/(authed)/meal/[id]/index.tsx:311` so both clients
 * surface the same total when the AI populates time eyebrows.
 *
 * Returns `null` when no step has a parseable duration — caller skips
 * the chip rather than rendering "0 min".
 */
function totalStepTimeLabel(
  steps: ReadonlyArray<{ time: string | null }>
): string | null {
  let totalMinutes = 0;
  let anyParsed = false;
  for (const step of steps) {
    if (!step.time) continue;
    const matches = step.time.matchAll(
      /(\d+(?:\.\d+)?)\s*(min|minute|minutes|hr|hour|hours)/gi
    );
    for (const m of matches) {
      const n = Number(m[1]);
      if (!Number.isFinite(n)) continue;
      const unit = m[2].toLowerCase();
      totalMinutes += unit.startsWith("h") ? n * 60 : n;
      anyParsed = true;
    }
  }
  if (!anyParsed || totalMinutes <= 0) return null;
  if (totalMinutes < 60) {
    return `~${Math.round(totalMinutes / 5) * 5 || totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const rem = totalMinutes - hours * 60;
  return rem === 0 ? `~${hours} hr` : `~${hours} hr ${rem} min`;
}

export type RecipeDetailMeal = {
  id: string;
  name: string;
  photoUrl: string | null;
  recipeText: string | null;
  recipeSourceUrl: string | null;
  ingredients: string[] | null;
  createdByUserId: string | null;
  createdByName: string | null;
  cookCount: number;
  lastCookedAt: string | null;
  effortLevel: "quick" | "easy" | "medium" | "high_effort" | null;
  structuredIngredients: Array<{
    id: string;
    position: number;
    name: string;
    quantityString: string;
    prepNote: string | null;
  }>;
  structuredSteps: Array<{
    id: string;
    position: number;
    title: string;
    time: string | null;
    body: string;
    ingredientIds: string[];
  }>;
};

export function RecipeDetailClient({ meal }: { meal: RecipeDetailMeal }) {
  // Structured-prefer with legacy fallback — mirrors mobile (R19) +
  // R21's web parity. Empty structured arrays mean the meal predates
  // the R18 Refine save path; fall through to the R10 text[] +
  // R7 recipeText blob.
  //
  // Wrap the array reads in `useMemo` so the `??` fallback identity
  // is stable for downstream memos. Without it, each render creates a
  // fresh `[]` and the dependent useMemos re-run unnecessarily.
  const structuredIngredients = React.useMemo(
    () => meal.structuredIngredients ?? [],
    [meal.structuredIngredients]
  );
  const structuredSteps = React.useMemo(
    () => meal.structuredSteps ?? [],
    [meal.structuredSteps]
  );
  const hasStructuredIngredients = structuredIngredients.length > 0;

  const sortedStructuredIngredients = React.useMemo(
    () =>
      hasStructuredIngredients
        ? structuredIngredients.slice().sort((a, b) => a.position - b.position)
        : [],
    [structuredIngredients, hasStructuredIngredients]
  );

  const stepCards: StepCardData[] = React.useMemo(() => {
    if (structuredSteps.length === 0) return [];
    const nameById = new Map<string, string>(
      structuredIngredients.map((row) => [row.id, row.name])
    );
    return structuredSteps
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row, idx) => ({
        number: idx + 1,
        title: row.title,
        time: row.time,
        body: row.body,
        ingredients: row.ingredientIds
          .map((iid) => nameById.get(iid))
          .filter((name): name is string => Boolean(name))
      }));
  }, [structuredSteps, structuredIngredients]);

  const totalTime = totalStepTimeLabel(structuredSteps);
  const ingredientCount = hasStructuredIngredients
    ? sortedStructuredIngredients.length
    : meal.ingredients?.length ?? 0;
  const stepCount = stepCards.length;

  // R28 — retroactive dynamic breadcrumb. The TopBar's static map
  // resolves `/meal/[id]` to "Recipe"; this hook replaces that last
  // crumb with the actual meal name. Cleanup runs on unmount so
  // back-navigation falls through to the static label.
  useSetBreadcrumb(meal.name);

  // Editorial title pair. Single-word names render headline-only;
  // multi-word names get the italic kicker + roman headline split
  // (e.g. "Chowmein," / "Noodles.").
  const titleParts = React.useMemo(
    () => splitMealName(meal.name),
    [meal.name]
  );

  // Meta line — degrades gracefully when fields aren't available.
  // "Added by {name} · {N} cook(s) · {timeAgo}" is the design's
  // target shape; we omit segments that don't have data rather than
  // rendering "0 cooks" or "Last cooked never".
  const metaLine = React.useMemo(() => {
    const addedBy = meal.createdByUserId
      ? meal.createdByName ?? "Former member"
      : "Former member";
    const segments: string[] = [];
    segments.push(`Added by ${addedBy}`);
    if (meal.cookCount > 0) {
      segments.push(
        meal.cookCount === 1 ? "1 cook" : `${meal.cookCount} cooks`
      );
    }
    const last = lastCookedLabel(meal.lastCookedAt);
    if (last && meal.cookCount > 0) {
      segments.push(last);
    }
    return segments.join(" · ");
  }, [
    meal.createdByUserId,
    meal.createdByName,
    meal.cookCount,
    meal.lastCookedAt
  ]);

  // TopBar actions — Refine + Log a cook. The Refine button routes
  // to R22's `/meal/[id]/refine`; Log a cook reuses the existing
  // `LogAgainButton` which calls `meals.createLog` with the meal name
  // (the service matches by normalized name + records an additional
  // cook on the existing meal row — R10 contract).
  const topBarActions = React.useMemo(
    () => (
      <>
        <Button
          asChild
          variant="outline"
          className="min-h-[40px]"
        >
          <Link href={`/meal/${meal.id}/refine` as Route}>
            <Sparkles className="h-3.5 w-3.5" />
            Refine with AI
          </Link>
        </Button>
        {/* LogAgainButton wraps `useCreateMealLogImperative` and
            handles toasts + error mapping. Same hook the dashboard
            uses, so the funnel telemetry stays consistent. */}
        <LogAgainButton
          mealName={meal.name}
          effortLevel={meal.effortLevel ?? "easy"}
          variant="default"
          size="default"
          icon="check"
          label="Log a cook"
          compact
          className="min-h-[40px]"
        />
      </>
    ),
    [meal.id, meal.name, meal.effortLevel]
  );
  useSetTopBarActions(topBarActions);

  return (
    // Outer wrapper bleeds out the layout's `<main>` padding
    // (`px-8 py-7` at md+, `px-4 py-5` below). Negative margins +
    // matching pb so the new bands fill edge-to-edge while the
    // layout-level bottom-tab clearance (`pb-20` / `pb-28`) still
    // applies via the layout itself. We don't neutralize the bottom
    // padding — its purpose is letting content clear the bottom
    // tab bar on mobile, which is still relevant.
    <div className="-mx-4 -my-5 sm:-mx-8 sm:-my-7">
      {/* Hero band — square hashed-palette tile + split title + chips. */}
      <section className="grid gap-0 border-b border-[var(--border)] md:grid-cols-[360px_1fr]">
        <div className="aspect-square w-full max-md:max-h-[360px] md:max-h-[360px]">
          {meal.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meal.photoUrl}
              alt={meal.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <MealTile
              name={meal.name}
              size="l"
              className="h-full w-full rounded-none border-0"
            />
          )}
        </div>
        <div className="flex flex-col gap-3 px-7 pb-7 pt-7 sm:px-9 sm:pt-9 md:gap-4 md:pt-9">
          <p
            className="font-mono text-[11px] uppercase text-[var(--subtle-fg,var(--muted-foreground))]"
            style={{ letterSpacing: "0.15em" }}
          >
            Recipe · in library
          </p>
          {titleParts.kicker ? (
            <p
              className="font-serif text-[24px] italic leading-none text-muted-foreground sm:text-[26px]"
              style={{ letterSpacing: "-0.005em" }}
            >
              {titleParts.kicker}
            </p>
          ) : null}
          <h1
            className="font-serif text-[60px] leading-[0.92] text-foreground sm:text-[72px] lg:text-[88px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {titleParts.headline}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {meal.effortLevel ? (
              <Badge variant={EFFORT_BADGE_VARIANT[meal.effortLevel]}>
                {EFFORT_LABEL[meal.effortLevel]}
              </Badge>
            ) : null}
            {ingredientCount > 0 ? (
              <Badge variant="ghost">
                {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {stepCount > 0 ? (
              <Badge variant="wheat">
                {stepCount} step{stepCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {totalTime ? (
              <Badge variant="ghost" className="font-mono">
                {totalTime}
              </Badge>
            ) : null}
          </div>
          <p
            className="mt-1 font-mono text-[11px] uppercase text-[var(--subtle-fg,var(--muted-foreground))]"
            style={{ letterSpacing: "0.13em" }}
          >
            {metaLine}
          </p>
        </div>
      </section>

      {/* Body band — cream-soft ingredients sidebar + recipe column. */}
      <section className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
        {/* Sidebar */}
        <aside className="border-b border-[var(--border)] bg-[var(--surface-2)] px-7 py-7 sm:px-9 md:border-b-0 md:border-r md:py-9">
          <SectionLabel
            className="mb-3"
            action={
              ingredientCount > 0 ? (
                <span
                  className="font-mono text-[11px] uppercase text-muted-foreground"
                  style={{ letterSpacing: "0.13em" }}
                >
                  {ingredientCount} {ingredientCount === 1 ? "item" : "items"}
                </span>
              ) : null
            }
          >
            Ingredients
          </SectionLabel>
          {hasStructuredIngredients ? (
            <StructuredIngredientList
              ingredients={sortedStructuredIngredients}
              mealName={meal.name}
            />
          ) : (
            <IngredientChecklist
              ingredients={meal.ingredients}
              mealName={meal.name}
              mealId={meal.id}
              canExtract={Boolean(meal.recipeText?.trim())}
            />
          )}
        </aside>

        {/* Recipe column */}
        <div className="px-7 py-7 sm:px-9 sm:py-10 md:pr-12">
          <SectionLabel
            className="mb-4"
            action={
              // Decorative "Cook mode" link for v1 — no separate route
              // yet. R27 spec parks the cook-mode surface; render as a
              // muted link to telegraph the planned affordance.
              <span
                className="inline-flex cursor-default items-center gap-1 font-medium text-[12px] text-primary opacity-70"
                aria-disabled
              >
                <Sparkles className="h-3 w-3" />
                Cook mode
              </span>
            }
          >
            Recipe
          </SectionLabel>
          {stepCards.length > 0 ? (
            <ol className="grid list-none divide-y divide-[var(--border-soft,var(--border))]">
              {stepCards.map((step) => (
                <li key={step.number}>
                  <StepCard step={step} />
                </li>
              ))}
            </ol>
          ) : meal.recipeText ? (
            // pre-wrap preserves the AI-extracted line breaks; font-sans
            // overrides the <pre> default so the recipe reads as prose,
            // not code. Comfortable reading line-height.
            <pre
              className={cn(
                "max-w-[620px] whitespace-pre-wrap font-sans text-[15px] leading-[1.6] text-foreground"
              )}
            >
              {meal.recipeText}
            </pre>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No recipe saved for this meal yet.
            </p>
          )}
          {meal.recipeSourceUrl ? (
            <div className="mt-8 grid gap-2">
              <SectionLabel>Source</SectionLabel>
              <SourceUrlEmbed
                url={meal.recipeSourceUrl}
                mealName={meal.name}
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href={meal.recipeSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  View original →
                </a>
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
