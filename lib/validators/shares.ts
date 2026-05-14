import { z } from "zod";

// Token shape: base64url-encoded `randomBytes(32)` = 43 chars (no
// padding). Min 32 is conservative — anything shorter is malformed.
// Same shape as household-invitation tokens; centralized validation
// keeps the two flows consistent.
const tokenString = z
  .string()
  .min(32, "Share token is malformed.")
  .max(128, "Share token is malformed.");

export const createRecipeShareSchema = z.object({
  mealId: z.string().uuid("Invalid meal id.")
});
export type CreateRecipeShareInput = z.infer<typeof createRecipeShareSchema>;

export const revokeRecipeShareSchema = z.object({
  shareId: z.string().uuid("Invalid share id.")
});
export type RevokeRecipeShareInput = z.infer<typeof revokeRecipeShareSchema>;

export const recipeShareTokenSchema = z.object({
  token: tokenString
});
export type RecipeShareTokenInput = z.infer<typeof recipeShareTokenSchema>;
