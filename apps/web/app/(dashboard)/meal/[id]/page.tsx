import { notFound } from "next/navigation";
import {
  RecipeDetailClient,
  type RecipeDetailMeal,
  type RecipeDetailViewer
} from "@/components/meals/recipe-detail-client";
import { RecipeDetailMobile } from "@/components/mobile/recipe-detail-mobile";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { countHouseholdMembers } from "@/services/households";
import { getMealDetail } from "@/services/meals";

export const dynamic = "force-dynamic";

/**
 * Round 27 — editorial Recipe Detail.
 *
 * Server component preserves R21+R25's SSR pattern: auth gate +
 * direct service call to `getMealDetail`. Rendering moves to a
 * client component because R26's TopBar actions slot is populated
 * via the `useSetTopBarActions` hook, which only runs in client
 * code. This file stays minimal — fetch, guard, hand off.
 *
 * The new visual contract lives in `<RecipeDetailClient>`:
 *   - Two stacked full-bleed bands (hero + body).
 *   - Editorial split title via `splitMealName`.
 *   - Structured-prefer ingredient rendering with legacy fallback.
 *   - TopBar action pair: Refine with AI + Log a cook.
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MealDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { user, household } = await requireCurrentUserWithHousehold();

  // R32 — fetch meal + member count in parallel. Member count drives
  // the TopBar share affordance + visibility chip; the recipe view
  // hides both on single-member households (no signal to surface
  // when there's no one else to share with).
  const [meal, memberCount] = await Promise.all([
    getMealDetail(user.id, household.id, id),
    countHouseholdMembers(user.id, household.id)
  ]);
  if (!meal) {
    notFound();
  }

  // The service's MealDetailView is structurally identical to the
  // client's `RecipeDetailMeal` — we narrow via the local type so
  // the client surface stays explicit about what it consumes.
  const payload: RecipeDetailMeal = {
    id: meal.id,
    name: meal.name,
    photoUrl: meal.photoUrl,
    recipeText: meal.recipeText,
    recipeSourceUrl: meal.recipeSourceUrl,
    servings: meal.servings,
    ingredients: meal.ingredients,
    recipeIsAiDraft: meal.recipeIsAiDraft,
    viewerCanEdit: meal.viewerCanEdit,
    viewerCanManageSharing: meal.viewerCanManageSharing,
    createdByUserId: meal.createdByUserId,
    createdByName: meal.createdByName,
    cookCount: meal.cookCount,
    lastCookedAt: meal.lastCookedAt,
    effortLevel: meal.effortLevel,
    structuredIngredients: meal.structuredIngredients ?? [],
    structuredSteps: meal.structuredSteps ?? []
  };

  const viewer: RecipeDetailViewer = {
    currentUserId: user.id,
    householdMemberCount: memberCount
  };

  return (
    <>
      <RecipeDetailMobile meal={payload} viewer={viewer} />
      <div className="hidden md:block">
        <RecipeDetailClient meal={payload} viewer={viewer} />
      </div>
    </>
  );
}
