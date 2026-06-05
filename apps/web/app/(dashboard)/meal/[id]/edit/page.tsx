import { notFound } from "next/navigation";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getMealDetail } from "@/services/meals";
import {
  ManualRecipeEditor,
  type EditorIngredient,
  type EditorStep
} from "@/components/meals/manual-recipe-editor";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Seed the steps editor from a legacy `recipeText` prose blob when a meal has
 * no structured steps. If the prose has a recognizable "Steps/Method/…" header,
 * split the lines after it into step rows; otherwise keep the whole blob in one
 * row (lossless) for the user to split by hand.
 */
function seedStepsFromRecipeText(recipeText: string | null): EditorStep[] {
  if (!recipeText || !recipeText.trim()) return [];
  const text = recipeText.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const headerIdx = lines.findIndex((l) =>
    /^\s*(steps|method|instructions|directions|preparation)\b/i.test(l.trim())
  );
  if (headerIdx >= 0) {
    const stepLines = lines
      .slice(headerIdx + 1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
      .filter((l) => l.length > 0);
    if (stepLines.length > 0) {
      return stepLines.map((body) => ({ title: "", time: "", body }));
    }
  }
  return [{ title: "", time: "", body: text.trim() }];
}

export default async function MealEditPage({ params }: PageProps) {
  const { id } = await params;
  const { user, household } = await requireCurrentUserWithHousehold();

  const meal = await getMealDetail(user.id, household.id, id);
  // Same write gate as Refine — only editors (owner / edit / admin grantee).
  if (!meal || !meal.viewerCanEdit) {
    notFound();
  }

  const initialIngredients: EditorIngredient[] =
    meal.structuredIngredients.length > 0
      ? meal.structuredIngredients.map((i) => ({
          name: i.name,
          quantityString: i.quantityString,
          prepNote: i.prepNote ?? ""
        }))
      : (meal.ingredients ?? []).map((line) => ({
          name: line,
          quantityString: "",
          prepNote: ""
        }));

  const initialSteps: EditorStep[] =
    meal.structuredSteps.length > 0
      ? meal.structuredSteps.map((s) => ({ title: s.title, time: s.time ?? "", body: s.body }))
      : seedStepsFromRecipeText(meal.recipeText);

  return (
    <main id="main" tabIndex={-1}>
      <ManualRecipeEditor
        mealId={meal.id}
        mealName={meal.name}
        initialIngredients={initialIngredients}
        initialSteps={initialSteps}
      />
    </main>
  );
}
