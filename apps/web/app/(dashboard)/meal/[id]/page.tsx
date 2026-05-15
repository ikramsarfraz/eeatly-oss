import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { IngredientChecklist } from "@/components/meals/ingredient-checklist";
import { MealBackLink } from "@/components/meals/meal-back-link";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { ShareButton } from "@/components/shares/share-button";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { classifyYoutubeUrl } from "@eeatly/api/validators/ai";
import { getMealDetail } from "@/services/meals";

export const dynamic = "force-dynamic";

/**
 * Round 10 — authenticated, household-scoped recipe view.
 *
 * Mobile-first single column (max-width ~720px on desktop). This is the
 * page the wife pulls up at Meijer to check what she needs for biryani,
 * so tap targets stay ≥44px and the ingredient checklist gets the
 * prominent slot. Recipe text is server-rendered with `whitespace-pre-wrap`
 * so the AI-extracted plain-text recipe reads naturally without a
 * separate markdown pass.
 *
 * Auth: viewer must be a member of the meal's household. A non-member
 * lands in the same `notFound()` branch as a totally-bogus mealId — we
 * don't want to leak which other households a stranger could
 * enumerate via 403-vs-404 differences.
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

function deriveSourceBadge(recipeSourceUrl: string | null): string | null {
  // We don't persist an explicit "AI source" column on the meal row, so
  // the only deterministic signal we have today is the source URL. Only
  // YouTube shows up here; the photo/voice/text paths leave the URL
  // empty. Keep this best-effort — wrong is worse than absent for a
  // micro-badge that adds no real signal beyond the link below.
  if (!recipeSourceUrl) return null;
  const cls = classifyYoutubeUrl(recipeSourceUrl);
  if (cls.kind === "watch") return "From YouTube";
  return null;
}

function lastCookedLabel(lastCookedAt: string | null): string | null {
  if (!lastCookedAt) return null;
  const days = differenceInCalendarDays(new Date(), parseISO(lastCookedAt));
  if (days <= 0) return "Cooked today";
  if (days === 1) return "Cooked yesterday";
  if (days < 7) return `Cooked ${days} days ago`;
  return `Last cooked ${format(parseISO(lastCookedAt), "MMM d, yyyy")}`;
}

export default async function MealDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { user, household } = await requireCurrentUserWithHousehold();

  const meal = await getMealDetail(user.id, household.id, id);
  if (!meal) {
    notFound();
  }

  const sourceBadge = deriveSourceBadge(meal.recipeSourceUrl);
  const cookedLabel = lastCookedLabel(meal.lastCookedAt);
  // Attribution for the original add. "by Former member" mirrors the
  // SET-NULL rendering convention from round 4.7 — see
  // lib/meals/attribution.ts. We don't suppress this for the viewer
  // who first added the meal: the credit line is about the recipe's
  // provenance in the household, not whose log this is.
  const addedBy = meal.createdByUserId
    ? meal.createdByName ?? "Former member"
    : "Former member";

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

      <header className="grid gap-1.5">
        <h1 className="font-serif text-[28px] font-normal leading-tight tracking-[-0.005em] sm:text-[34px]">
          {meal.name}
        </h1>
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
          {sourceBadge ? (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" aria-hidden />
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] uppercase tracking-[0.06em]">
                {sourceBadge}
              </span>
            </>
          ) : null}
        </p>
      </header>

      <section aria-labelledby="ingredients-heading" className="grid gap-2.5">
        <h2
          id="ingredients-heading"
          className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Ingredients
        </h2>
        <IngredientChecklist
          ingredients={meal.ingredients}
          mealName={meal.name}
          mealId={meal.id}
          canExtract={Boolean(meal.recipeText?.trim())}
        />
      </section>

      <section aria-labelledby="recipe-heading" className="grid gap-2.5">
        <h2
          id="recipe-heading"
          className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Recipe
        </h2>
        {meal.recipeText ? (
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
        ) : null}
      </section>

      {/* Action row — share + log again. Edit/delete aren't surfaced
          here because the app doesn't yet have a meal-level edit or
          archive flow (only the per-log delete on /history). Add when
          those flows exist. */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
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
