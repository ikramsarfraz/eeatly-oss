import { notFound } from "next/navigation";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getMealDetail } from "@/services/meals";
import { parseStructuredRecipe } from "@/lib/meals/parse-recipe";
import { EditAssistClient } from "@/components/assist/edit-assist-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** One-line display string for an ingredient (quantity + name + prep). */
function ingredientLine(i: { quantityString: string; name: string; prepNote: string | null }): string {
  const head = [i.quantityString, i.name]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const prep = (i.prepNote ?? "").trim();
  return prep ? `${head}, ${prep}` : head;
}

/** One-line display string for a step (title + body). */
function stepLine(s: { title: string; body: string }): string {
  const title = (s.title ?? "").trim();
  const body = (s.body ?? "").trim();
  if (title && body) return `${title}: ${body}`;
  return title || body;
}

export default async function MealEditPage({ params }: PageProps) {
  const { id } = await params;
  const { user, household } = await requireCurrentUserWithHousehold();

  const meal = await getMealDetail(user.id, household.id, id);
  // Same write gate as Refine — only editors (owner / edit / admin grantee).
  if (!meal || !meal.viewerCanEdit) {
    notFound();
  }

  // Prefer structured rows; fall back to the legacy prose/array parser so legacy
  // meals open with cleanly separated single-line rows.
  const parsedLegacy = parseStructuredRecipe(meal.recipeText, meal.ingredients);

  const ingredients =
    meal.structuredIngredients.length > 0
      ? meal.structuredIngredients.map(ingredientLine)
      : parsedLegacy.ingredients.map(ingredientLine);

  const steps =
    meal.structuredSteps.length > 0
      ? meal.structuredSteps.map(stepLine)
      : parsedLegacy.steps.map(stepLine);

  return (
    <main id="main" tabIndex={-1}>
      <EditAssistClient
        mealId={meal.id}
        mealName={meal.name}
        effort={meal.effortLevel}
        servings={meal.servings ?? ""}
        ingredients={ingredients.filter((t) => t.trim().length > 0)}
        steps={steps.filter((t) => t.trim().length > 0)}
      />
    </main>
  );
}
