import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { meals } from "@/db/schema";
import { mealIngredients, recipeSteps } from "@/db/schema";
import { requireItemEditor } from "@/services/sharing";

/**
 * Credit-free MANUAL editing of a meal's structured recipe.
 *
 * Writes the same `meal_ingredients` + `recipe_steps` tables the AI "Refine"
 * flow uses, so manual edits always render (the recipe view prefers structured
 * rows) and stay consistent with Refine — but without any AI call or credit
 * spend. This is the path a user out of AI credits uses to build/fix a recipe.
 *
 * Authorization mirrors Refine: `requireItemEditor` (owner or an edit/admin
 * grantee), so shared recipes are editable by the same people who can refine
 * them. The save is a full transactional REPLACE of the meal's structured rows
 * (simpler and more predictable than a diff): the submitted lists become the
 * recipe, re-positioned 0..n.
 */

export type ManualIngredientInput = {
  name: string;
  quantityString?: string;
  prepNote?: string | null;
};

export type ManualStepInput = {
  title: string;
  time?: string | null;
  body?: string;
};

export async function saveStructuredRecipe(args: {
  userId: string;
  mealId: string;
  ingredients: ManualIngredientInput[];
  steps: ManualStepInput[];
}): Promise<{ ingredientCount: number; stepCount: number }> {
  // Authorize as a write (same gate as Refine). Loads the meal first so the
  // canonical not-authorized error doesn't leak whether the meal exists.
  const mealRow = await db.query.meals.findFirst({
    where: and(eq(meals.id, args.mealId), isNull(meals.archivedAt))
  });
  if (!mealRow) throw new Error("Not authorized to edit this item.");
  await requireItemEditor(args.userId, "recipe", args.mealId, mealRow.createdByUserId);

  // Normalize + drop blank rows. An ingredient needs a name; a step needs a
  // title or a body.
  const cleanIngredients = args.ingredients
    .map((i) => ({
      name: i.name.trim(),
      quantityString: (i.quantityString ?? "").trim(),
      prepNote: i.prepNote?.trim() ? i.prepNote.trim() : null
    }))
    .filter((i) => i.name.length > 0);

  const cleanSteps = args.steps
    .map((s) => ({
      title: s.title.trim(),
      time: s.time?.trim() ? s.time.trim() : null,
      body: (s.body ?? "").trim()
    }))
    .filter((s) => s.title.length > 0 || s.body.length > 0);

  await db.transaction(async (tx) => {
    // Replace: clear existing structured rows, then re-insert at fresh
    // positions. The unique (meal_id, position) index is satisfied because we
    // delete first and index sequentially.
    await tx.delete(mealIngredients).where(eq(mealIngredients.mealId, args.mealId));
    await tx.delete(recipeSteps).where(eq(recipeSteps.mealId, args.mealId));

    if (cleanIngredients.length > 0) {
      await tx.insert(mealIngredients).values(
        cleanIngredients.map((i, idx) => ({
          mealId: args.mealId,
          position: idx,
          name: i.name,
          quantityString: i.quantityString,
          prepNote: i.prepNote
        }))
      );
    }

    if (cleanSteps.length > 0) {
      await tx.insert(recipeSteps).values(
        cleanSteps.map((s, idx) => ({
          mealId: args.mealId,
          position: idx,
          title: s.title || "Step",
          time: s.time,
          body: s.body,
          // Step↔ingredient linking is deferred; readers tolerate empty.
          ingredientIds: [] as string[]
        }))
      );
    }

    await tx.update(meals).set({ updatedAt: new Date() }).where(eq(meals.id, args.mealId));
  });

  return { ingredientCount: cleanIngredients.length, stepCount: cleanSteps.length };
}
