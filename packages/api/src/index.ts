// Round 12 — top-level barrel. Consumers can do either:
//   import { mealLogInputSchema } from "@eeatly/api";
//   import { mealLogInputSchema } from "@eeatly/api/validators";
//   import { mealLogInputSchema } from "@eeatly/api/validators/meals";
//
// Granular paths are recommended for tree-shaking on the web; mobile's
// Metro bundler treats them roughly equivalently.
export * from "./enums";
export * from "./errors";
export * from "./types";
export * from "./validators";
export * from "./gates";
