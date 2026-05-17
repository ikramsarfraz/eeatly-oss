import { differenceInCalendarDays, format, parseISO } from "date-fns";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { IngredientChecklist } from "@/components/meals/ingredient-checklist";
import { MealBackLink } from "@/components/meals/meal-back-link";
import { StepCard, type StepCardData } from "@/components/meals/step-card";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { ShareButton } from "@/components/shares/share-button";
import { SourceUrlEmbed } from "@/components/embeds/source-url-embed";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { SectionLabel } from "@/components/ui/section-label";
import { detectPlatform } from "@eeatly/shared";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getMealDetail } from "@/services/meals";

function platformLabel(url: string): string | null {
  const detected = detectPlatform(url);
  if (!detected) return null;
  switch (detected.platform) {
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "pinterest":
      return "Pinterest";
    case "instagram":
      return "Instagram";
    case "web":
      return null;
  }
}

export const dynamic = "force-dynamic";

/**
 * Round 21 — recipe view with web read-parity for the R18 structured
 * recipe tables. Prefer `meals.structuredIngredients` /
 * `meals.structuredSteps` when populated; fall back to the legacy
 * `meals.ingredients` text[] and `meals.recipeText` blob when not.
 * This mirrors the mobile read pattern at
 * `apps/mobile/app/(authed)/meal/[id]/index.tsx` (lines 437–483) and
 * closes the silent data-fidelity bug where a meal refined on mobile
 * appeared unchanged on web.
 *
 * Page stays SSR — `getMealDetail` already returns the structured
 * fields, no need to move to client-side tRPC. Mobile-first single
 * column (max-width ~720px). Auth: viewer must be a household member;
 * non-members hit `notFound()` so 404-vs-403 doesn't leak which other
 * households exist.
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

type StructuredIngredient = {
  id: string;
  position: number;
  name: string;
  quantityString: string;
  prepNote: string | null;
};

type StructuredStep = {
  id: string;
  position: number;
  title: string;
  time: string | null;
  body: string;
  ingredientIds: string[];
};

function lastCookedLabel(lastCookedAt: string | null): string | null {
  if (!lastCookedAt) return null;
  const days = differenceInCalendarDays(new Date(), parseISO(lastCookedAt));
  if (days <= 0) return "Cooked today";
  if (days === 1) return "Cooked yesterday";
  if (days < 7) return `Cooked ${days} days ago`;
  return `Last cooked ${format(parseISO(lastCookedAt), "MMM d, yyyy")}`;
}

/**
 * Flatten one structured ingredient row into the single-string shape
 * `IngredientChecklist` already consumes. Combining qty/name/note here
 * avoids reshaping the checklist's prop contract and keeps the
 * WhatsApp / Copy shopping-list export feeding off the same lines the
 * user sees on screen.
 */
function flattenStructuredIngredient(row: StructuredIngredient): string {
  const qty = row.quantityString.trim();
  const note = row.prepNote?.trim();
  const head = qty ? `${qty} ${row.name}` : row.name;
  return note ? `${head} (${note})` : head;
}

export default async function MealDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { user, household } = await requireCurrentUserWithHousehold();

  const meal = await getMealDetail(user.id, household.id, id);
  if (!meal) {
    notFound();
  }

  const cookedLabel = lastCookedLabel(meal.lastCookedAt);
  // Attribution for the original add. "by Former member" mirrors the
  // SET-NULL rendering convention from round 4.7 — see
  // lib/meals/attribution.ts. We don't suppress this for the viewer
  // who first added the meal: the credit line is about the recipe's
  // provenance in the household, not whose log this is.
  const addedBy = meal.createdByUserId
    ? meal.createdByName ?? "Former member"
    : "Former member";

  // Structured-prefer with legacy fallback — mirrors the mobile read
  // pattern. When the structured tables are empty (meal predates the
  // Refine flow), fall through to the R10 text[] / R7 recipeText blob.
  const structuredIngredients = (meal.structuredIngredients ??
    []) as StructuredIngredient[];
  const structuredSteps = (meal.structuredSteps ?? []) as StructuredStep[];

  const displayIngredientLines: string[] | null =
    structuredIngredients.length > 0
      ? structuredIngredients
          .slice()
          .sort((a, b) => a.position - b.position)
          .map(flattenStructuredIngredient)
      : meal.ingredients;

  // Resolve `ingredientIds` to display names via the structured map.
  // Stale ids (ingredient deleted but still referenced) get filtered
  // out — matches the mobile tolerance for out-of-sync denormalisation.
  let stepCards: StepCardData[] = [];
  if (structuredSteps.length > 0) {
    const nameById = new Map<string, string>(
      structuredIngredients.map((row) => [row.id, row.name])
    );
    stepCards = structuredSteps
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
  }

  return (
    <article className="mx-auto grid w-full max-w-[720px] gap-5 px-4 pb-12 pt-3 sm:px-6 sm:pt-4">
      <MealBackLink fallbackHref={"/dashboard" as Route} />

      {meal.photoUrl ? (
        // Plain <img> per project policy. R2 URLs are already public;
        // serving direct avoids a round-trip through our origin.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meal.photoUrl}
          alt={meal.name}
          className="aspect-[4/3] w-full rounded-xl border bg-muted object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border bg-[var(--surface-2)] text-muted-foreground"
        >
          <span className="text-xs uppercase tracking-[0.12em]">no photo</span>
        </div>
      )}

      <header className="grid gap-2">
        <PageTitle title={meal.name} size="l" />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
          <span>
            Added by <strong className="text-foreground">{addedBy}</strong>
          </span>
          <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" aria-hidden />
          <span>
            {meal.cookCount === 0
              ? "Never cooked"
              : meal.cookCount === 1
                ? "Cooked once"
                : `Cooked ${meal.cookCount} times`}
          </span>
          {cookedLabel ? (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" aria-hidden />
              <span>{cookedLabel}</span>
            </>
          ) : null}
        </p>
      </header>

      <section aria-labelledby="ingredients-heading" className="grid gap-2.5">
        <SectionLabel id="ingredients-heading">Ingredients</SectionLabel>
        <IngredientChecklist
          ingredients={displayIngredientLines}
          mealName={meal.name}
          mealId={meal.id}
          canExtract={Boolean(meal.recipeText?.trim())}
        />
      </section>

      <section aria-labelledby="recipe-heading" className="grid gap-2.5">
        <SectionLabel id="recipe-heading">Recipe</SectionLabel>
        {stepCards.length > 0 ? (
          <ol className="grid list-none gap-2.5">
            {stepCards.map((step) => (
              <li key={step.number}>
                <StepCard step={step} />
              </li>
            ))}
          </ol>
        ) : meal.recipeText ? (
          // pre-wrap preserves the AI-extracted line breaks; font-sans
          // overrides the <pre> default so the recipe reads as prose,
          // not code. Comfortable reading line-height for mobile.
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-[1.55] text-foreground">
            {meal.recipeText}
          </pre>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No recipe saved for this meal yet.
          </p>
        )}
        {meal.recipeSourceUrl ? (
          <div className="grid gap-2">
            <SourceUrlEmbed url={meal.recipeSourceUrl} mealName={meal.name} />
            <p className="text-xs text-muted-foreground">
              <a
                href={meal.recipeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                View original on {platformLabel(meal.recipeSourceUrl) ?? "the source site"} →
              </a>
            </p>
          </div>
        ) : null}
      </section>

      {/* Action row — refine + share + log again. Edit/delete aren't
          surfaced here because the app doesn't yet have a meal-level
          edit or archive flow (only the per-log delete on /history).
          Add when those flows exist. */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button asChild variant="default" className="min-h-[40px]">
          <Link href={`/meal/${meal.id}/refine` as Route}>
            <Sparkles className="h-3.5 w-3.5" />
            Refine recipe
          </Link>
        </Button>
        <LogAgainButton
          mealName={meal.name}
          variant="default"
          label="Log again"
          compact
        />
        <ShareButton mealId={meal.id} mealName={meal.name} variant="default" />
      </div>
    </article>
  );
}
