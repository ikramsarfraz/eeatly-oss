/**
 * Round 10 — typed error for the legacy-meal ingredient extraction
 * flow. Surfaces the "can't extract from nothing" case so the action
 * layer can map it to a tailored UI message (the meal has no
 * `recipeText`; the user needs to log a recipe before extraction
 * makes sense).
 */
export class NoRecipeTextError extends Error {
  readonly code = "NO_RECIPE_TEXT" as const;
  constructor() {
    super(
      "This meal doesn't have a recipe saved — there's nothing to extract ingredients from."
    );
    this.name = "NoRecipeTextError";
  }
}
