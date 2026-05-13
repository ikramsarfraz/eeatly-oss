import { z } from "zod";
import { effortLevelSchema } from "./meals";

// Step 2 of onboarding — cooking habits questionnaire.
export const onboardingHabitsInputSchema = z.object({
  cooksPerWeek: z
    .number()
    .int()
    .min(0, "Pick a number between 0 and 14.")
    .max(14, "Pick a number between 0 and 14."),
  weeknightEffort: effortLevelSchema
});

export type OnboardingHabitsInput = z.infer<typeof onboardingHabitsInputSchema>;

// Discrete buckets surfaced to the user on the cadence question. Stored as
// the bucket's midpoint integer in cooks_per_week so we can compute averages
// later without losing the original choice intent (zero ↔ buckets shouldn't
// be confused).
export const COOK_FREQUENCY_BUCKETS = [
  { value: 0, label: "Rarely", helper: "0–1 cooks a week" },
  { value: 3, label: "Sometimes", helper: "2–3 cooks a week" },
  { value: 5, label: "Often", helper: "4–5 cooks a week" },
  { value: 7, label: "Daily-ish", helper: "6+ cooks a week" }
] as const;

export type CookFrequencyBucket = (typeof COOK_FREQUENCY_BUCKETS)[number]["value"];
