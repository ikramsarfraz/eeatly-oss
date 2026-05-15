import { z } from "zod";

import type { BetaCohort } from "@/types";

export const betaCohortValues = ["alpha", "beta_wave_1", "beta_wave_2", "internal"] as const satisfies Readonly<BetaCohort[]>;

export const betaCohortFormSchema = z.union([
  z.enum(["alpha", "beta_wave_1", "beta_wave_2", "internal"]),
  z.literal(""),
  z.literal("__clear__")
]);

export function parseBetaCohortFormValue(value: unknown): BetaCohort | null {
  const parsed = betaCohortFormSchema.safeParse(value);

  if (!parsed.success || parsed.data === "" || parsed.data === "__clear__") {
    return null;
  }

  return parsed.data;
}
