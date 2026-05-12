import { z } from "zod";

export const effortLevelSchema = z.enum(["quick", "easy", "medium", "high_effort"]);

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
  photoUrl: z
    .string()
    .trim()
    .url("Photo URL must be valid.")
    .optional()
    .or(z.literal("")),
  recipeText: z
    .string()
    .max(10000, "Recipe should stay under 10,000 characters.")
    .optional()
    .or(z.literal("")),
  recipeSourceUrl: z
    .string()
    .trim()
    .url("Recipe source must be a valid URL.")
    .optional()
    .or(z.literal(""))
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
