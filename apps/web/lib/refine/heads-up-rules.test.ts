import { describe, expect, it } from "vitest";
import { detectHeadsUp } from "./heads-up-rules";
import type { PendingChange } from "@eeatly/api/validators/refine";
import type { RecipeContext } from "@/services/ai-refine";

// Avoid pulling `@/lib/db/client` (which transitively pulls
// `@neondatabase/serverless`) into a pure-function test. The rule
// engine imports `RecipeContext` from `services/ai-refine` only as a
// type — no runtime mock is needed.

function baseRecipe(overrides: Partial<RecipeContext> = {}): RecipeContext {
  return {
    id: "m-1",
    name: "Chowmein Noodles",
    effortLevel: "medium",
    ingredients: [
      {
        id: "i-chicken",
        position: 0,
        name: "Chicken",
        quantityString: "400 g",
        prepNote: "boneless, sliced"
      },
      {
        id: "i-salt",
        position: 1,
        name: "Salt",
        quantityString: "1 tsp",
        prepNote: null
      }
    ],
    steps: [],
    ...overrides
  };
}

describe("heads-up rule: heavy ingredient quantity bump", () => {
  it("fires when chicken crosses 500 g upward from a medium-effort recipe", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "change",
        target: "ingredient",
        refId: "i-chicken",
        field: "quantityString",
        before: "400 g",
        after: "600 g"
      }
    ];
    const out = detectHeadsUp(recipe, changes);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      severity: "warn",
      title: "Heads up"
    });
    expect(out[0].body).toMatch(/medium to high/);
    expect(out[0].suggestedAction?.label).toMatch(/Keep effort medium/);
  });

  it("does not fire when the quantity drop direction is downward", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "change",
        target: "ingredient",
        refId: "i-chicken",
        field: "quantityString",
        before: "600 g",
        after: "400 g"
      }
    ];
    expect(detectHeadsUp(recipe, changes)).toHaveLength(0);
  });

  it("does not fire on non-heavy ingredients", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "change",
        target: "ingredient",
        refId: "i-salt",
        field: "quantityString",
        before: "1 tsp",
        after: "700 g"
      }
    ];
    expect(detectHeadsUp(recipe, changes)).toHaveLength(0);
  });

  it("does not fire when effort is already high_effort", () => {
    const recipe = baseRecipe({ effortLevel: "high_effort" });
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "change",
        target: "ingredient",
        refId: "i-chicken",
        field: "quantityString",
        before: "400 g",
        after: "600 g"
      }
    ];
    expect(detectHeadsUp(recipe, changes)).toHaveLength(0);
  });

  it("fires across the pound threshold (1 lb)", () => {
    const recipe = baseRecipe({ effortLevel: "easy" });
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "change",
        target: "ingredient",
        refId: "i-chicken",
        field: "quantityString",
        before: "0.5 lb",
        after: "1 lb"
      }
    ];
    const out = detectHeadsUp(recipe, changes);
    expect(out).toHaveLength(1);
    expect(out[0].body).toMatch(/easy to medium/);
  });
});

describe("heads-up rule: bulk ingredient growth", () => {
  it("fires when ≥5 ingredient adds land on a small recipe", () => {
    const recipe = baseRecipe(); // currentCount=2
    const adds: PendingChange[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      kind: "add" as const,
      target: "ingredient" as const,
      payload: { name: `Spice ${i + 1}`, quantityString: "1 tsp" }
    }));
    const out = detectHeadsUp(recipe, adds);
    // Multiple rules could trigger; ensure THIS rule's id is in the set.
    expect(out.some((h) => h.id === "ingredient-count-spike")).toBe(true);
  });

  it("does not fire when the diff only nets +4 ingredients", () => {
    const recipe = baseRecipe();
    const adds: PendingChange[] = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`,
      kind: "add" as const,
      target: "ingredient" as const,
      payload: { name: `Spice ${i + 1}`, quantityString: "1 tsp" }
    }));
    const out = detectHeadsUp(recipe, adds);
    expect(out.some((h) => h.id === "ingredient-count-spike")).toBe(false);
  });

  it("does not fire when the recipe already has 10+ ingredients", () => {
    const lots = Array.from({ length: 12 }, (_, i) => ({
      id: `i-${i}`,
      position: i,
      name: `Ingredient ${i}`,
      quantityString: "1 tsp",
      prepNote: null
    }));
    const recipe = baseRecipe({ ingredients: lots });
    const adds: PendingChange[] = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      kind: "add" as const,
      target: "ingredient" as const,
      payload: { name: `Spice ${i + 1}`, quantityString: "1 tsp" }
    }));
    expect(detectHeadsUp(recipe, adds)).toHaveLength(0);
  });
});

describe("heads-up rule: long new step time", () => {
  it("fires (info) when an added step's time exceeds 10 minutes", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "add",
        target: "step",
        payload: { title: "Slow simmer", time: "25 min", body: "Let it cook" }
      }
    ];
    const out = detectHeadsUp(recipe, changes);
    expect(out.some((h) => h.severity === "info")).toBe(true);
    expect(out.find((h) => h.id.startsWith("new-step-time"))).toBeTruthy();
  });

  it("does not fire when the new step is short", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "add",
        target: "step",
        payload: { title: "Quick toss", time: "3 min", body: "Toss everything" }
      }
    ];
    const out = detectHeadsUp(recipe, changes);
    expect(out.find((h) => h.id.startsWith("new-step-time"))).toBeFalsy();
  });
});

describe("heads-up rule: empty ingredient quantity", () => {
  it("fires (info) when an added ingredient has no quantity", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "add",
        target: "ingredient",
        payload: { name: "Cilantro" }
      }
    ];
    const out = detectHeadsUp(recipe, changes);
    expect(out.some((h) => h.id.startsWith("empty-qty"))).toBe(true);
  });

  it("does not fire when the added ingredient carries a quantity", () => {
    const recipe = baseRecipe();
    const changes: PendingChange[] = [
      {
        id: "c1",
        kind: "add",
        target: "ingredient",
        payload: { name: "Cilantro", quantityString: "2 tbsp" }
      }
    ];
    const out = detectHeadsUp(recipe, changes);
    expect(out.some((h) => h.id.startsWith("empty-qty"))).toBe(false);
  });
});

describe("heads-up engine entry", () => {
  it("returns an empty array when there are no pending changes", () => {
    expect(detectHeadsUp(baseRecipe(), [])).toEqual([]);
  });
});
