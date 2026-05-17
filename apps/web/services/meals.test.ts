import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Proxy db mock — same shape as services/ai.test.ts / households.test.ts.
// No transactions in the public surface this test exercises (getMealDetail
// is read-only), so the transaction-callback override isn't needed.
const dbState = vi.hoisted(() => {
  const queue: Array<() => Promise<unknown>> = [];

  type Chain = ((...args: unknown[]) => Chain) & PromiseLike<unknown> & {
    [key: string]: unknown;
  };

  function makeChain(): Chain {
    const handler: ProxyHandler<Chain> = {
      get(_target, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (v: unknown) => unknown,
            onRejected?: (e: unknown) => unknown
          ) => {
            const resolver = queue.shift();
            if (!resolver) {
              return Promise.reject(
                new Error("dbState: queue empty — test forgot to enqueue a result.")
              ).then(onFulfilled, onRejected);
            }
            return resolver().then(onFulfilled, onRejected);
          };
        }
        return proxy;
      },
      apply: () => proxy
    };
    const fn: unknown = () => proxy;
    const proxy = new Proxy(fn as Chain, handler);
    return proxy;
  }

  const chain = makeChain();
  return { chain, queue };
});

vi.mock("@/lib/db/client", () => ({ db: dbState.chain }));

// Short-circuit lib/auth/index.ts env validation (services/meals.ts imports
// requireHouseholdMember which transitively pulls auth/index.ts at module
// load).
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));

vi.mock("@/lib/auth/session", () => sessionMock);

import { getMealDetail } from "./meals";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("getMealDetail (Round 10)", () => {
  it("rejects non-members BEFORE touching the meal lookup", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      getMealDetail("u-stranger", "h-other", "m-1")
    ).rejects.toThrow(/Not authorized/);

    // No DB reads queued — if the service had bypassed the gate, the
    // afterEach queue-empty assertion would fail with a clearer error.
    expect(dbState.queue).toHaveLength(0);
  });

  it("returns null when the meal row is missing (404 surface)", async () => {
    // First query: meal lookup returns []. The stats roll-up never runs
    // because getMealDetail short-circuits on the missing row.
    queue([]);

    const result = await getMealDetail("u-member", "h-a", "m-missing");

    expect(result).toBeNull();
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-member", "h-a");
  });

  it("returns the meal + stats roll-up when the member check passes", async () => {
    queue([
      {
        id: "m-1",
        name: "Biryani",
        photoUrl: "https://example.com/biryani.jpg",
        recipeText: "1. rinse rice\n2. cook",
        recipeSourceUrl: null,
        ingredients: ["1 cup basmati rice", "2 tbsp ghee"],
        notes: null,
        createdAt: new Date("2026-04-01T12:00:00Z"),
        createdByUserId: "u-author",
        createdByName: "Ali"
      }
    ]);
    queue([
      {
        cookCount: 3,
        lastCookedAt: "2026-05-10"
      }
    ]);
    // Effort aggregate — two medium, one high. Modal = medium.
    queue([
      { effortLevel: "medium", n: 2 },
      { effortLevel: "high_effort", n: 1 }
    ]);
    // R19 — structured ingredients + steps queries (in parallel). The
    // proxy db.queue serialises both Promise.all branches; queue order
    // is "ingredients first, then steps" because the destructured array
    // resolves left-to-right under microtask ordering.
    queue([
      {
        id: "mi-1",
        position: 0,
        name: "Chicken",
        quantityString: "400 g",
        prepNote: "boneless, sliced"
      }
    ]);
    queue([
      {
        id: "rs-1",
        position: 0,
        title: "Marinate the chicken",
        time: "10 min",
        body: "Combine with spices and rest.",
        ingredientIds: ["mi-1"]
      }
    ]);

    const result = await getMealDetail("u-member", "h-a", "m-1");

    expect(result).toEqual({
      id: "m-1",
      name: "Biryani",
      photoUrl: "https://example.com/biryani.jpg",
      recipeText: "1. rinse rice\n2. cook",
      recipeSourceUrl: null,
      ingredients: ["1 cup basmati rice", "2 tbsp ghee"],
      notes: null,
      createdByUserId: "u-author",
      createdByName: "Ali",
      cookCount: 3,
      lastCookedAt: "2026-05-10",
      createdAt: "2026-04-01T12:00:00.000Z",
      effortLevel: "medium",
      structuredIngredients: [
        {
          id: "mi-1",
          position: 0,
          name: "Chicken",
          quantityString: "400 g",
          prepNote: "boneless, sliced"
        }
      ],
      structuredSteps: [
        {
          id: "rs-1",
          position: 0,
          title: "Marinate the chicken",
          time: "10 min",
          body: "Combine with spices and rest.",
          ingredientIds: ["mi-1"]
        }
      ]
    });
  });

  it("returns a valid shape for a legacy meal with null ingredients and no logs", async () => {
    queue([
      {
        id: "m-legacy",
        name: "Old recipe",
        photoUrl: null,
        recipeText: null,
        recipeSourceUrl: null,
        ingredients: null,
        notes: null,
        createdAt: new Date("2025-01-01T00:00:00Z"),
        createdByUserId: null,
        createdByName: null
      }
    ]);
    queue([{ cookCount: 0, lastCookedAt: null }]);
    // No logs → empty effort aggregate → effortLevel: null.
    queue([] as Array<{ effortLevel: "quick" | "easy" | "medium" | "high_effort"; n: number }>);
    // R19 — legacy meal has no structured ingredient/step rows either.
    queue([] as Array<{
      id: string;
      position: number;
      name: string;
      quantityString: string;
      prepNote: string | null;
    }>);
    queue([] as Array<{
      id: string;
      position: number;
      title: string;
      time: string | null;
      body: string;
      ingredientIds: string[];
    }>);

    const result = await getMealDetail("u-member", "h-a", "m-legacy");

    expect(result).not.toBeNull();
    expect(result?.ingredients).toBeNull();
    expect(result?.recipeText).toBeNull();
    expect(result?.cookCount).toBe(0);
    expect(result?.lastCookedAt).toBeNull();
    expect(result?.createdByUserId).toBeNull();
    expect(result?.effortLevel).toBeNull();
    expect(result?.structuredIngredients).toEqual([]);
    expect(result?.structuredSteps).toEqual([]);
  });
});
