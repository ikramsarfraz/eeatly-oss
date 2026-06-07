/**
 * R34 — raised by `saveStructuredRecipe` when a rename would collide with
 * another recipe in the same household (the `(household_id, normalized_name)`
 * unique index). The tRPC layer maps `code` to a `MEAL_NAME_COLLISION` cause
 * the Edit screen surfaces as a friendly "name already used" message.
 */
export class MealNameTakenError extends Error {
  readonly code = "MEAL_NAME_COLLISION" as const;
  constructor(name: string) {
    super(`You already have a recipe named "${name}". Pick a different name.`);
    this.name = "MealNameTakenError";
  }
}
