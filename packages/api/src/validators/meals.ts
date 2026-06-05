import { z } from "zod";

export const effortLevelSchema = z.enum(["quick", "easy", "medium", "high_effort"]);

// `z.string().url()` happily accepts javascript:, data:, file: — all of which
// would XSS-by-link if rendered as `<a href>` or `<img src>` (data: also
// risky in CSP-light contexts). Restrict to http(s) to keep stored values
// safe regardless of how they're later rendered.
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use http or https." }
  );

export const mealLogInputSchema = z.object({
  mealName: z
    .string()
    .trim()
    .min(2, "Add a meal name.")
    .max(120, "Keep the meal name under 120 characters."),
  effortLevel: effortLevelSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Notes should stay under 1000 characters.")
    .optional()
    .or(z.literal("")),
  cookedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid cooked date."),
  photoUrl: httpUrl.optional().or(z.literal("")),
  recipeText: z
    .string()
    .max(10000, "Recipe should stay under 10,000 characters.")
    .optional()
    .or(z.literal("")),
  recipeSourceUrl: httpUrl.optional().or(z.literal("")),
  // Free-form yield/servings, e.g. "Serves 4", "Makes 8 sliders". AI-filled
  // on capture; persisted verbatim. Empty string when no yield was stated.
  servings: z
    .string()
    .trim()
    .max(120, "Keep the servings note under 120 characters.")
    .optional()
    .or(z.literal("")),
  // Round 10: AI-extracted ingredient list. Each entry is one line as
  // the recipe presents it ("1 cup basmati rice"). Trimmed in the
  // service before persist; entries that empty out are dropped.
  ingredients: z
    .array(z.string().max(200, "Ingredient line is too long."))
    .max(100, "Recipes shouldn't carry more than 100 ingredient lines.")
    .optional()
});

export type MealLogInput = z.infer<typeof mealLogInputSchema>;

export const presignedUploadInputSchema = z.object({
  filename: z.string().min(1).max(180),
  contentType: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("image/"), "Only image uploads are supported.")
});

export type PresignedUploadInput = z.infer<typeof presignedUploadInputSchema>;

/**
 * Attach (or replace) a meal's own photo from a device upload. The URL is
 * the public R2 location returned by the presign flow; the `httpUrl`
 * refinement keeps stored values safe to render as `<img src>` later.
 */
export const setMealPhotoInputSchema = z.object({
  mealId: z.string().uuid(),
  photoUrl: httpUrl
});

export type SetMealPhotoInput = z.infer<typeof setMealPhotoInputSchema>;

/**
 * Manual (no-AI, no-credit) structured recipe edit. The submitted ingredient +
 * step lists fully REPLACE the meal's structured rows (see
 * `services/recipe-edit.ts`). Blank rows are dropped server-side, so the client
 * can keep trailing empty rows in the editor without consequence.
 */
export const manualRecipeInputSchema = z.object({
  mealId: z.string().uuid(),
  ingredients: z
    .array(
      z.object({
        name: z.string().max(200, "Ingredient name is too long."),
        quantityString: z.string().max(120, "Quantity is too long.").optional(),
        prepNote: z.string().max(200, "Prep note is too long.").nullable().optional()
      })
    )
    .max(100, "Recipes shouldn't carry more than 100 ingredients."),
  steps: z
    .array(
      z.object({
        title: z.string().max(160, "Step title is too long."),
        time: z.string().max(80, "Step time is too long.").nullable().optional(),
        body: z.string().max(4000, "Step text is too long.").optional()
      })
    )
    .max(60, "Recipes shouldn't carry more than 60 steps.")
});

export type ManualRecipeInput = z.infer<typeof manualRecipeInputSchema>;
