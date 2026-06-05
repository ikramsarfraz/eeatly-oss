import { notFound } from "next/navigation";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getMealDetail } from "@/services/meals";
import { parseStructuredRecipe } from "@/lib/meals/parse-recipe";
import {
  ManualRecipeEditor,
  type EditorIngredient,
  type EditorStep
} from "@/components/meals/manual-recipe-editor";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MealEditPage({ params }: PageProps) {
  const { id } = await params;
  const { user, household } = await requireCurrentUserWithHousehold();

  const meal = await getMealDetail(user.id, household.id, id);
  // Same write gate as Refine — only editors (owner / edit / admin grantee).
  if (!meal || !meal.viewerCanEdit) {
    notFound();
  }

  // Legacy meals (pre auto-structuring) have only the prose blob + ingredient
  // array — parse them the same way log-time does so the editor opens with
  // cleanly separated rows.
  const parsedLegacy = parseStructuredRecipe(meal.recipeText, meal.ingredients);

  const initialIngredients: EditorIngredient[] =
    meal.structuredIngredients.length > 0
      ? meal.structuredIngredients.map((i) => ({
          name: i.name,
          quantityString: i.quantityString,
          prepNote: i.prepNote ?? ""
        }))
      : parsedLegacy.ingredients.map((i) => ({
          name: i.name,
          quantityString: i.quantityString,
          prepNote: i.prepNote ?? ""
        }));

  const initialSteps: EditorStep[] =
    meal.structuredSteps.length > 0
      ? meal.structuredSteps.map((s) => ({ title: s.title, time: s.time ?? "", body: s.body }))
      : parsedLegacy.steps.map((s) => ({ title: s.title, time: s.time ?? "", body: s.body }));

  return (
    <main id="main" tabIndex={-1}>
      <ManualRecipeEditor
        mealId={meal.id}
        mealName={meal.name}
        initialServings={meal.servings ?? ""}
        initialIngredients={initialIngredients}
        initialSteps={initialSteps}
      />
    </main>
  );
}
