/**
 * Parse a free-form / markdown recipe blob into structured ingredients + steps.
 *
 * AI capture returns the recipe as a single `recipeText` blob (often markdown
 * with "### Ingredients" / "### Instructions" sections) plus a separate
 * `ingredients` array. Stored as-is, the recipe view shows the ingredients
 * twice (the array as a checklist AND the blob as prose) and the manual editor
 * can't cleanly split the steps. This splits the blob ONCE, at log time, so the
 * recipe lands as structured rows (clean checklist + step cards).
 *
 * Pure + framework-agnostic so it runs server-side (createMealLog) and can seed
 * the manual editor for legacy meals. Conservative: it only produces steps when
 * it can confidently find them, so it never invents junk.
 */

export type ParsedIngredient = { name: string; quantityString: string; prepNote: string | null };
export type ParsedStep = { title: string; time: string | null; body: string };

const INGREDIENT_HEADER = /^#{0,6}\s*\**\s*ingredients?\b/i;
const STEP_HEADER = /^#{0,6}\s*\**\s*(instructions?|steps?|method|directions?|preparation)\b/i;

/** Strip leading markdown headers, list markers (1. / 1) / - / * / •) and bold. */
function cleanLine(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function isHeader(line: string): boolean {
  return INGREDIENT_HEADER.test(line) || STEP_HEADER.test(line);
}

export function parseStructuredRecipe(
  recipeText: string | null | undefined,
  ingredients: readonly string[] | null | undefined
): { ingredients: ParsedIngredient[]; steps: ParsedStep[] } {
  const text = (recipeText ?? "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  let ingStart = -1;
  let stepStart = -1;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (ingStart === -1 && INGREDIENT_HEADER.test(t)) ingStart = i;
    if (stepStart === -1 && STEP_HEADER.test(t)) stepStart = i;
  });

  // Ingredient lines: prefer the AI-separated array; else the lines under the
  // ingredients header (stop at the next header).
  let ingredientLines: string[] = [];
  if (ingredients && ingredients.length > 0) {
    ingredientLines = ingredients.map((s) => s.trim()).filter(Boolean);
  } else if (ingStart >= 0) {
    const end = stepStart > ingStart ? stepStart : lines.length;
    ingredientLines = lines
      .slice(ingStart + 1, end)
      .filter((l) => !isHeader(l.trim()))
      .map(cleanLine)
      .filter(Boolean);
  }

  // Step lines: prefer the lines under a steps/method header. Failing that,
  // treat a run of numbered lines ("1. …", "2) …") as the steps — AI/markdown
  // recipes number their steps and bullet their ingredients, so a numbered run
  // is a reliable step signal even without a header. Otherwise leave empty (the
  // caller keeps the legacy recipeText prose as the fallback).
  let stepLines: string[] = [];
  if (stepStart >= 0) {
    stepLines = lines
      .slice(stepStart + 1)
      .filter((l) => !isHeader(l.trim()))
      .map(cleanLine)
      .filter(Boolean);
  } else {
    const numbered = lines.filter((l) => /^\s*\d+[.)]\s+/.test(l));
    if (numbered.length >= 2) {
      stepLines = numbered.map(cleanLine).filter(Boolean);
    }
  }

  return {
    ingredients: ingredientLines.map((name) => ({ name, quantityString: "", prepNote: null })),
    // Single instructions have no separate title; the step card numbers them
    // and renders the body (it hides an empty title).
    steps: stepLines.map((body) => ({ title: "", time: null, body }))
  };
}
