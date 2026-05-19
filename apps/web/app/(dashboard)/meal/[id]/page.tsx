import { differenceInCalendarDays, format, parseISO } from "date-fns";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { IngredientChecklist } from "@/components/meals/ingredient-checklist";
import { MealBackLink } from "@/components/meals/meal-back-link";
import { StepCard, type StepCardData } from "@/components/meals/step-card";
import {
  StructuredIngredientList,
  formatStructuredIngredientForExport
} from "@/components/meals/structured-ingredient-list";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { ShareButton } from "@/components/shares/share-button";
import { SourceUrlEmbed } from "@/components/embeds/source-url-embed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealTile } from "@/components/ui/meal-tile";
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
 * Round 25 — recipe view layout polish.
 *
 * Builds on R21's structured-read parity by:
 *   1. Adding a real hero — photo when present, hashed-palette
 *      `<MealTile>` monogram when not. Same 4:3 frame either way.
 *   2. Rendering the chip row (effort / step-count / time / source
 *      platform) below the title. Mirrors the mobile chip row pattern
 *      at `apps/mobile/app/(authed)/meal/[id]/index.tsx` lines 572–604.
 *   3. Switching to a two-column layout at `md` (~820px) and above —
 *      sticky sidebar with hero + ingredients on the left, main column
 *      with video embed + recipe steps on the right. Below `md` the
 *      page stays single-column (the R21 mobile-first stack).
 *   4. Routing structured ingredients through the new
 *      `<StructuredIngredientList>` so qty + name + prep-note render
 *      as distinct visual slots. Legacy meals (no structured rows)
 *      continue to use `<IngredientChecklist>` unchanged.
 *
 * Still SSR — `getMealDetail` already returns the structured fields,
 * no need to move to client-side tRPC. Auth: viewer must be a household
 * member; non-members hit `notFound()` so 404-vs-403 doesn't leak
 * which other households exist.
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

const EFFORT_BADGE_VARIANT: Record<
  "quick" | "easy" | "medium" | "high_effort",
  "sage" | "wheat" | "terra"
> = {
  quick: "sage",
  easy: "sage",
  medium: "wheat",
  high_effort: "terra"
};

const EFFORT_LABEL: Record<"quick" | "easy" | "medium" | "high_effort", string> = {
  quick: "Quick to make",
  easy: "Easy effort",
  medium: "Medium effort",
  high_effort: "High effort"
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

/**
 * Flatten one structured ingredient row into the single-string shape
 * `IngredientChecklist` already consumes. R21 introduced this for the
 * legacy fallback path; R25 keeps the helper in place because the
 * page still routes legacy meals through `IngredientChecklist` (the
 * legacy component's contract is unchanged), and reuses
 * `formatStructuredIngredientForExport` (exported from the new
 * structured component) for the WhatsApp / Copy export shape that the
 * structured renderer ships internally.
 */
function flattenStructuredIngredient(row: StructuredIngredient): string {
  return formatStructuredIngredientForExport(row);
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
  const hasStructuredIngredients = structuredIngredients.length > 0;

  const sortedStructuredIngredients = hasStructuredIngredients
    ? structuredIngredients.slice().sort((a, b) => a.position - b.position)
    : [];

  // For the legacy fallback path we still need a flattened list for
  // `IngredientChecklist`'s string[] contract. When structured rows
  // exist, the page routes through `<StructuredIngredientList>`
  // instead and this array is unused.
  const legacyIngredientLines: string[] | null = hasStructuredIngredients
    ? sortedStructuredIngredients.map(flattenStructuredIngredient)
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

  const stepCount = stepCards.length;
  const totalTime = totalStepTimeLabel(structuredSteps);
  const ingredientCount = hasStructuredIngredients
    ? sortedStructuredIngredients.length
    : meal.ingredients?.length ?? 0;
  const sourcePlatform = meal.recipeSourceUrl
    ? platformLabel(meal.recipeSourceUrl)
    : null;

  // Hero: photo wins when present; MealTile monogram with hashed
  // palette is the empty-state. Same 4:3 frame either way so the
  // sidebar grid track stays predictable.
  const hero = meal.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meal.photoUrl}
      alt={meal.name}
      className="aspect-[4/3] w-full rounded-xl border bg-muted object-cover"
    />
  ) : (
    <MealTile name={meal.name} size="l" className="aspect-[4/3] w-full border" />
  );

  // The sidebar column on `md`+ holds hero + ingredients. The "Section
  // Label + content" group repeats verbatim across both breakpoints —
  // factor into a render fragment so the two-column / single-column
  // branches stay readable.
  const ingredientsSection = (
    <section aria-labelledby="ingredients-heading" className="grid gap-2.5">
      <SectionLabel id="ingredients-heading">Ingredients</SectionLabel>
      {hasStructuredIngredients ? (
        <StructuredIngredientList
          ingredients={sortedStructuredIngredients}
          mealName={meal.name}
        />
      ) : (
        <IngredientChecklist
          ingredients={legacyIngredientLines}
          mealName={meal.name}
          mealId={meal.id}
          canExtract={Boolean(meal.recipeText?.trim())}
        />
      )}
    </section>
  );

  // Recipe steps + source embed live in the main (right) column at
  // md+. At narrow widths the page stacks below the ingredients.
  const recipeSection = (
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
        // not code. Comfortable reading line-height.
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
  );

  // Action row — refine + share + log again. Stays in the title band
  // so it floats above the two-column split at md+. Wraps below the
  // title on narrow widths.
  const actionRow = (
    <div className="flex flex-wrap items-center gap-2">
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
  );

  // Chip row. Effort first (semantic palette via mobile mapping), then
  // step count + total time + source platform. Each chip is gated on
  // having real data — no "0 steps" placeholder. Allowed to wrap on
  // narrow viewports rather than truncating (R25 skip rule).
  const chipRow = (
    <div className="flex flex-wrap items-center gap-2">
      {meal.effortLevel ? (
        <Badge variant={EFFORT_BADGE_VARIANT[meal.effortLevel]}>
          {EFFORT_LABEL[meal.effortLevel]}
        </Badge>
      ) : null}
      {totalTime ? (
        <Badge variant="ghost" className="font-mono text-[11px] uppercase">
          {totalTime}
        </Badge>
      ) : ingredientCount > 0 ? (
        <Badge variant="ghost">
          {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
        </Badge>
      ) : null}
      {stepCount > 0 ? (
        <Badge variant="wheat">
          {stepCount} step{stepCount === 1 ? "" : "s"}
        </Badge>
      ) : null}
      {sourcePlatform ? (
        <Badge variant="sage">From {sourcePlatform}</Badge>
      ) : null}
    </div>
  );

  return (
    // Outer article: full width up to a generous max so the two-column
    // grid has room to breathe at md+. The 720px clamp from R21 stays
    // for the single-column path via the inner grid.
    <article className="mx-auto grid w-full max-w-[1080px] gap-5 px-4 pb-12 pt-3 sm:px-6 sm:pt-4">
      <MealBackLink fallbackHref={"/dashboard" as Route} />

      {/* Title band — runs full-width across both breakpoints. */}
      <header className="grid gap-3">
        <div className="grid gap-2.5 md:grid-cols-[1fr_auto] md:items-end md:gap-4">
          <div className="grid gap-2">
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
          </div>
          {/* Right-aligned actions on md+; wrap below the title band
              on narrow widths. */}
          <div className="md:justify-self-end">{actionRow}</div>
        </div>
        {chipRow}
      </header>

      {/* Body: two-column at md+, stacked below. The grid track ratio
          tracks the mobile design intent (sidebar narrower than the
          main reading column). 320px min on the sidebar so the
          ingredient names + qty column don't collide; main column
          takes whatever remains, bounded by the outer 1080px clamp. */}
      <div className="grid gap-6 md:grid-cols-[minmax(320px,1fr)_2fr] md:items-start md:gap-8">
        {/* Sidebar — sticky at md+. `self-start` keeps the sticky
            container's height from being stretched by the grid; the
            top offset matches `--header-h` (60px) plus an 8px
            breathing band. Internal max-height + overflow lets very
            long ingredient lists scroll inside the sidebar rather
            than pushing the sticky element off-screen. */}
        <aside className="grid gap-5 md:sticky md:top-[calc(var(--header-h)_+_8px)] md:max-h-[calc(100vh_-_var(--header-h)_-_24px)] md:self-start md:overflow-y-auto md:pb-2 md:pr-1">
          {hero}
          {ingredientsSection}
        </aside>

        {/* Main column */}
        <div className="grid gap-5">{recipeSection}</div>
      </div>
    </article>
  );
}
