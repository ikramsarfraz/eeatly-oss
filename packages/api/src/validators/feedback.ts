import { z } from "zod";

export const feedbackTypeSchema = z.enum([
  "bug",
  "confusion",
  "feature_request",
  "general"
]);

export const feedbackInputSchema = z.object({
  type: feedbackTypeSchema,
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can understand the feedback.")
    .max(2000, "Keep feedback under 2000 characters."),
  context: z
    .string()
    .trim()
    .max(240, "Keep context short.")
    .optional()
    .or(z.literal(""))
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;
