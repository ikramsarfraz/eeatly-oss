import type {
  HeadsUp,
  PendingChange
} from "@eeatly/api/validators/refine";
import type { RecipeContext } from "@/services/ai-refine";

/**
 * Round 18 — heads-up rule engine.
 *
 * The Review screen surfaces "Heads up" sage cards when a known
 * derived-field threshold is crossed by the pending diff. Per the
 * design spec, rules are explicit code rather than AI-generated: the
 * user trusts that the warnings are stable, not hallucinated.
 *
 * Each rule is a pure function `(recipe, changes) => HeadsUp | null`.
 * The engine maps over all rules and filters nulls. Stable `id` so the
 * mobile client can dedupe / dismiss persistently if we ever want that.
 *
 * Adding a rule = add an entry to `RULES`. Keep them small + cheap;
 * the engine runs on every `getPendingChanges` poll.
 */

type Rule = (
  recipe: RecipeContext,
  changes: PendingChange[]
) => HeadsUp | null;

/** Ingredient names (lower-case, normalised) we consider "heavy" — a
 *  large quantity change here is more likely to bump effort than the
 *  same delta on, say, salt. */
const HEAVY_INGREDIENTS = new Set([
  "chicken",
  "beef",
  "lamb",
  "mutton",
  "fish",
  "salmon",
  "shrimp",
  "prawn",
  "pork",
  "turkey",
  "duck",
  "goat"
]);

/**
 * Pulls the leading numeric token out of a quantity string. Returns
 * null when the string is non-numeric ("a pinch", "to taste") or when
 * no number is present.
 *
 * Examples:
 *   "400 g"       → 400
 *   "1 1/2 cups"  → 1
 *   "½ tsp"       → null  (unicode fraction — out of scope for the
 *                          quantity-threshold rule; we just skip)
 */
function leadingNumber(qty: string): number | null {
  const match = qty.match(/^\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Rule 1 — heavy-ingredient quantity bump nudges effort tier.
 *
 * If a "change · ingredient · quantityString" lands on a heavy
 * ingredient AND the new quantity crosses 500 g (or 1 lb / 16 oz) AND
 * the current effort is `quick`/`easy`/`medium`, warn that effort may
 * need to bump up.
 */
const heavyQuantityRule: Rule = (recipe, changes) => {
  if (recipe.effortLevel === "high_effort" || recipe.effortLevel === null) {
    return null;
  }
  for (const c of changes) {
    if (c.kind !== "change") continue;
    if (c.target !== "ingredient") continue;
    if (c.field !== "quantityString") continue;
    const ingredient = recipe.ingredients.find((i) => i.id === c.refId);
    if (!ingredient) continue;
    if (!HEAVY_INGREDIENTS.has(normaliseName(ingredient.name))) continue;
    const after = typeof c.after === "string" ? c.after : "";
    const before = typeof c.before === "string" ? c.before : "";
    const afterN = leadingNumber(after);
    const beforeN = leadingNumber(before);
    if (afterN === null || beforeN === null) continue;
    // Trigger if we're crossing 500g (or 1 lb / 16 oz) upward.
    const isGrams = /\b(g|gram|grams)\b/i.test(after);
    const isOunces = /\b(oz|ounce|ounces)\b/i.test(after);
    const isPounds = /\b(lb|lbs|pound|pounds)\b/i.test(after);
    const crossesUp =
      (isGrams && afterN >= 500 && beforeN < 500) ||
      (isOunces && afterN >= 16 && beforeN < 16) ||
      (isPounds && afterN >= 1 && beforeN < 1);
    if (!crossesUp) continue;
    const nextEffort = nextHigherEffort(recipe.effortLevel);
    if (!nextEffort) continue;
    return {
      id: `heavy-qty-${ingredient.id}`,
      severity: "warn",
      title: "Heads up",
      body: `Bumping the ${ingredient.name.toLowerCase()} to ${after.trim()} pushes effort from ${recipe.effortLevel} to ${nextEffort}. Tap to keep ${recipe.effortLevel}.`,
      suggestedAction: {
        label: `Keep effort ${recipe.effortLevel}`,
        payload: { kind: "lock-effort", effortLevel: recipe.effortLevel }
      }
    };
  }
  return null;
};

/**
 * Rule 2 — bulk ingredient-count growth nudges effort tier.
 *
 * If pending changes net-add ≥5 ingredients to a recipe with <10
 * ingredients, the recipe is probably crossing complexity tiers. Warn.
 */
const ingredientCountRule: Rule = (recipe, changes) => {
  if (recipe.effortLevel === "high_effort") return null;
  const currentCount = recipe.ingredients.length;
  if (currentCount >= 10) return null;
  let netAdd = 0;
  for (const c of changes) {
    if (c.target !== "ingredient") continue;
    if (c.kind === "add") netAdd += 1;
    else if (c.kind === "remove") netAdd -= 1;
  }
  if (netAdd < 5) return null;
  const nextEffort = nextHigherEffort(recipe.effortLevel) ?? "high_effort";
  return {
    id: "ingredient-count-spike",
    severity: "warn",
    title: "Heads up",
    body: `You're adding ${netAdd} ingredients to a recipe with ${currentCount}. That tends to bump effort up to ${nextEffort}.`,
    suggestedAction: recipe.effortLevel
      ? {
          label: `Keep effort ${recipe.effortLevel}`,
          payload: { kind: "lock-effort", effortLevel: recipe.effortLevel }
        }
      : undefined
  };
};

/**
 * Rule 3 — long new step nudges total time chip.
 *
 * If the diff adds a step whose `time` parses to >10 min, surface a
 * heads-up so the user knows the "~30 min" total chip on the recipe
 * detail screen may need a refresh.
 */
const newStepTimeRule: Rule = (recipe, changes) => {
  // No need to look up current total — the "~30 min" chip is hand-tuned
  // per the design spec. We just flag any long addition so the user can
  // re-tune it themselves.
  for (const c of changes) {
    if (c.kind !== "add") continue;
    if (c.target !== "step") continue;
    const payload = c.payload as { time?: string | null; title?: string };
    if (!payload?.time) continue;
    const match = payload.time.match(/(\d+(?:\.\d+)?)\s*(min|minute|minutes)/i);
    if (!match) continue;
    const minutes = Number(match[1]);
    if (!Number.isFinite(minutes) || minutes <= 10) continue;
    return {
      id: `new-step-time-${payload.title ?? "step"}`,
      severity: "info",
      title: "Heads up",
      body: `New step adds ${match[0]} of prep — the total time chip on the recipe may need a refresh.`,
      suggestedAction: undefined
    };
  }
  // Defensive read of `recipe` so the unused-variable linter doesn't
  // flag the parameter on the no-match path. The variable is reserved
  // for future rules that want to compute the existing total.
  void recipe;
  return null;
};

/**
 * Rule 4 — added ingredient without a quantity. Info-severity.
 *
 * Adds where `payload.quantityString` is empty are likely incomplete.
 * Surface as info so the user notices before saving.
 */
const emptyQuantityRule: Rule = (_recipe, changes) => {
  for (const c of changes) {
    if (c.kind !== "add") continue;
    if (c.target !== "ingredient") continue;
    const payload = c.payload as {
      name?: string;
      quantityString?: string;
    };
    if (!payload?.name) continue;
    const qty = (payload.quantityString ?? "").trim();
    if (qty.length > 0) continue;
    return {
      id: `empty-qty-${payload.name}`,
      severity: "info",
      title: "Heads up",
      body: `${payload.name} was added without a quantity. Save it anyway, or tap to edit the quantity first.`,
      suggestedAction: undefined
    };
  }
  return null;
};

const RULES: Rule[] = [
  heavyQuantityRule,
  ingredientCountRule,
  newStepTimeRule,
  emptyQuantityRule
];

export function detectHeadsUp(
  recipe: RecipeContext,
  pendingChanges: PendingChange[]
): HeadsUp[] {
  if (pendingChanges.length === 0) return [];
  const out: HeadsUp[] = [];
  for (const rule of RULES) {
    const hit = rule(recipe, pendingChanges);
    if (hit) out.push(hit);
  }
  return out;
}

function nextHigherEffort(
  current: "quick" | "easy" | "medium" | "high_effort" | null
): "easy" | "medium" | "high_effort" | null {
  switch (current) {
    case "quick":
      return "easy";
    case "easy":
      return "medium";
    case "medium":
      return "high_effort";
    default:
      return null;
  }
}
