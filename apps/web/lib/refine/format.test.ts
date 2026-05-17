import { describe, expect, it } from "vitest";
import type { PendingChange } from "@eeatly/api/validators/refine";
import {
  describePendingChange,
  formatScalar,
  summariseCounts,
  type ResolverContext
} from "./format";

const ctx: ResolverContext = {
  ingredients: [
    {
      id: "ing-1",
      position: 0,
      name: "basmati rice",
      quantityString: "1 cup",
      prepNote: "rinsed"
    },
    { id: "ing-2", position: 1, name: "salt", quantityString: "1 tsp" }
  ],
  steps: [
    {
      id: "step-1",
      position: 0,
      title: "Rinse rice",
      time: "5 min",
      body: "Rinse until water runs clear."
    }
  ]
};

describe("formatScalar", () => {
  it("renders an em-dash for nullish or empty values", () => {
    expect(formatScalar(null)).toBe("—");
    expect(formatScalar(undefined)).toBe("—");
    expect(formatScalar("")).toBe("—");
  });

  it("passes strings through and stringifies numbers + booleans", () => {
    expect(formatScalar("hello")).toBe("hello");
    expect(formatScalar(42)).toBe("42");
    expect(formatScalar(true)).toBe("true");
  });

  it("joins arrays with comma + skips empty members", () => {
    expect(formatScalar(["a", "", "b", null])).toBe("a, b");
  });

  it("falls back to JSON for arbitrary objects", () => {
    expect(formatScalar({ k: 1 })).toBe('{"k":1}');
  });
});

describe("summariseCounts", () => {
  it("counts each kind and totals them", () => {
    const changes: PendingChange[] = [
      { id: "1", kind: "add", target: "ingredient", payload: { name: "x" } },
      {
        id: "2",
        kind: "change",
        target: "ingredient",
        refId: "ing-1",
        field: "name",
        before: "a",
        after: "b"
      },
      { id: "3", kind: "remove", target: "step", refId: "step-1", before: "x" },
      {
        id: "4",
        kind: "change",
        target: "step",
        refId: "step-1",
        field: "body",
        before: "a",
        after: "b"
      }
    ];
    expect(summariseCounts(changes)).toEqual({
      add: 1,
      change: 2,
      remove: 1,
      total: 4
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(summariseCounts([])).toEqual({ add: 0, change: 0, remove: 0, total: 0 });
  });
});

describe("describePendingChange — add", () => {
  it("renders an ingredient add with qty + name in the title and parts in `after`", () => {
    const change: PendingChange = {
      id: "1",
      kind: "add",
      target: "ingredient",
      payload: { name: "garlic", quantityString: "3 cloves", prepNote: "minced" }
    };
    const d = describePendingChange(change, ctx);
    expect(d.verb).toBe("Added");
    expect(d.title).toBe("garlic · 3 cloves");
    expect(d.typeLabel).toBe("ADDED · INGREDIENT");
    expect(d.before).toBeNull();
    expect(d.after).toBe("3 cloves · minced");
  });

  it("renders a step add with the new step's position-based label", () => {
    const change: PendingChange = {
      id: "2",
      kind: "add",
      target: "step",
      payload: { title: "Sauté onion", body: "5 minutes until soft.", position: 2 }
    };
    const d = describePendingChange(change, ctx);
    expect(d.verb).toBe("Added");
    expect(d.title).toBe("Step 3 · Sauté onion");
    expect(d.typeLabel).toBe("ADDED · STEP");
    expect(d.after).toBe("5 minutes until soft.");
  });
});

describe("describePendingChange — change", () => {
  it("resolves ingredient refId → name and renders before/after", () => {
    const change: PendingChange = {
      id: "3",
      kind: "change",
      target: "ingredient",
      refId: "ing-1",
      field: "quantityString",
      before: "1 cup",
      after: "1.5 cups"
    };
    const d = describePendingChange(change, ctx);
    expect(d.verb).toBe("Changed");
    expect(d.title).toBe("basmati rice · quantity");
    expect(d.typeLabel).toBe("CHANGED · INGREDIENT · ROW 1");
    expect(d.before).toBe("1 cup");
    expect(d.after).toBe("1.5 cups");
  });

  it("falls back to a short refId when the ingredient row isn't in context", () => {
    const change: PendingChange = {
      id: "4",
      kind: "change",
      target: "ingredient",
      refId: "missing-id-abcd",
      field: "name",
      before: "x",
      after: "y"
    };
    const d = describePendingChange(change, ctx);
    expect(d.typeLabel).toBe("CHANGED · INGREDIENT · ROW ABCD");
  });

  it("renders a step body change", () => {
    const change: PendingChange = {
      id: "5",
      kind: "change",
      target: "step",
      refId: "step-1",
      field: "body",
      before: "old body",
      after: "new body"
    };
    const d = describePendingChange(change, ctx);
    expect(d.title).toBe("Rinse rice · body");
    expect(d.typeLabel).toBe("CHANGED · STEP 1");
  });
});

describe("describePendingChange — remove", () => {
  it("removes an ingredient and surfaces qty + prep in `before`", () => {
    const change: PendingChange = {
      id: "6",
      kind: "remove",
      target: "ingredient",
      refId: "ing-1",
      before: undefined
    };
    const d = describePendingChange(change, ctx);
    expect(d.verb).toBe("Removed");
    expect(d.title).toBe("basmati rice");
    expect(d.typeLabel).toBe("REMOVED · INGREDIENT · ROW 1");
    expect(d.before).toBe("1 cup · rinsed");
    expect(d.after).toBeNull();
  });

  it("removes a step and uses the body as the `before`", () => {
    const change: PendingChange = {
      id: "7",
      kind: "remove",
      target: "step",
      refId: "step-1",
      before: undefined
    };
    const d = describePendingChange(change, ctx);
    expect(d.title).toBe("Rinse rice");
    expect(d.typeLabel).toBe("REMOVED · STEP 1");
    expect(d.before).toBe("Rinse until water runs clear.");
  });

  it("recognises a legacy refId pattern and pulls the row index out of it", () => {
    const change: PendingChange = {
      id: "8",
      kind: "remove",
      target: "ingredient",
      refId: "legacy-ingredient-3",
      before: "old text"
    };
    const d = describePendingChange(change, ctx);
    expect(d.typeLabel).toBe("REMOVED · INGREDIENT · ROW 4");
  });
});
