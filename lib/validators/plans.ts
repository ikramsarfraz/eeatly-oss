import { z } from "zod";

// Effort enum reused from meals — kept in sync with db/schema/meals.ts
// `effort_level`. Listed here as a literal union (instead of importing the
// schema) so this module stays client-safe; lib/validators/ is imported
// from both server actions and client forms.
const EFFORT = ["quick", "easy", "medium", "high_effort"] as const;
const VERDICT = ["repeat", "modify", "do_not_repeat"] as const;

// Scheduled date is calendar-level — store as YYYY-MM-DD string. We match
// the same shape as mealLogInputSchema.cookedDate so the form components
// can share date-picker logic later.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

const PLAN_NAME_MAX = 80;
const NOTES_MAX = 2000;
const ANNOTATION_NOTES_MAX = 2000;

export const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the plan a name.")
    .max(PLAN_NAME_MAX, `Keep the name under ${PLAN_NAME_MAX} characters.`),
  scheduledDate: dateString,
  // No transform here so the inferred input/output types stay aligned
  // for react-hook-form. The service trims and treats empty as null.
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX, `Notes are limited to ${NOTES_MAX} characters.`)
    .optional()
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

// Partial — any subset of the fields can be patched, but at least one must
// be present (caller shouldn't issue an empty update).
export const updatePlanSchema = createPlanSchema.partial().refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  { message: "Provide at least one field to update." }
);
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const addDishToPlanSchema = z.object({
  mealId: z.string().uuid("Invalid meal id.")
});
export type AddDishToPlanInput = z.infer<typeof addDishToPlanSchema>;

export const removeDishFromPlanSchema = z.object({
  planDishId: z.string().uuid("Invalid plan dish id.")
});
export type RemoveDishFromPlanInput = z.infer<typeof removeDishFromPlanSchema>;

export const reorderDishesSchema = z.object({
  dishIdsInOrder: z
    .array(z.string().uuid("Invalid plan dish id."))
    .min(1, "Provide at least one dish to reorder.")
    .max(200, "Too many dishes in one reorder.")
});
export type ReorderDishesInput = z.infer<typeof reorderDishesSchema>;

export const updateDishAnnotationSchema = z
  .object({
    actualEffort: z.enum(EFFORT).nullable().optional(),
    timeTakenMinutes: z
      .number()
      .int()
      .min(0, "Minutes can't be negative.")
      .max(60 * 24, "Time is capped at 24 hours.")
      .nullable()
      .optional(),
    verdict: z.enum(VERDICT).nullable().optional(),
    annotationNotes: z
      .string()
      .trim()
      .max(ANNOTATION_NOTES_MAX, `Notes are limited to ${ANNOTATION_NOTES_MAX} characters.`)
      .nullable()
      .optional()
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one annotation field to update."
  });
export type UpdateDishAnnotationInput = z.infer<typeof updateDishAnnotationSchema>;

export const clonePlanSchema = z.object({
  sourcePlanId: z.string().uuid("Invalid source plan id."),
  newName: z
    .string()
    .trim()
    .min(1, "Give the new plan a name.")
    .max(PLAN_NAME_MAX, `Keep the name under ${PLAN_NAME_MAX} characters.`),
  newScheduledDate: dateString
});
export type ClonePlanInput = z.infer<typeof clonePlanSchema>;
