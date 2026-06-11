import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Proxy db mock — same Proxy-chain-with-queue pattern as
// households.test.ts, including the transaction-callback override
// (createMealLog runs inside db.transaction).
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
        if (prop === "transaction") {
          return (fn: (tx: Chain) => Promise<unknown> | unknown) =>
            Promise.resolve().then(() => fn(proxy));
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

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));

vi.mock("@/lib/auth/session", () => sessionMock);

// services/sharing is mocked so the grant-role lookup is controllable per
// test without modeling its SQL. The other exports are stubs that
// services/meals.ts imports at module level but createMealLog never calls.
const sharingMock = vi.hoisted(() => ({
  getGrantRole: vi.fn<() => Promise<"view" | "edit" | "admin" | null>>(),
  canEditItem: (role: string | null) => role === "edit" || role === "admin" || role === "owner",
  canManageSharing: (role: string | null) => role === "admin" || role === "owner",
  notifyGranteesOfUpdate: vi.fn(),
  requireItemEditor: vi.fn()
}));

vi.mock("@/services/sharing", () => sharingMock);

import { createMealLog } from "./meals";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  sharingMock.getGrantRole.mockReset();
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

const BASE_INPUT = {
  mealName: "Chicken Biryani",
  effortLevel: "easy" as const,
  notes: "",
  cookedDate: "2026-06-10",
  photoUrl: ""
};

/**
 * 0045 — meal-row resolution at log time is own → granted → create-own.
 * Another member's PRIVATE same-named row must never be matched: before
 * 0045 the household-wide unique index forced exactly that (B's log and
 * recipe-field updates landed on A's private row).
 */
describe("createMealLog row resolution (0045 per-creator coexistence)", () => {
  it("logs against the viewer's own row when one exists (no grant lookup)", async () => {
    // 1. own-row findFirst → hit. The grant fallback + getGrantRole are
    //    never queried (queue drain proves it).
    queue({ id: "m-own", createdByUserId: "u-b", photoUrl: null });
    queue([]); // update meals (photo/recipe pass-through on own row)
    queue([{ id: "log-1", mealId: "m-own" }]); // insert meal_logs .returning
    queue([{ value: 4 }]); // per-user log count

    const result = await createMealLog("u-b", "h-a", BASE_INPUT);

    expect(result.mealLog).toEqual({ id: "log-1", mealId: "m-own" });
    expect(result.mealLogCount).toBe(4);
    expect(sharingMock.getGrantRole).not.toHaveBeenCalled();
  });

  it("creates a fresh own row instead of touching another member's private same-named row", async () => {
    queue(undefined); // own-row findFirst → none
    queue(undefined); // granted-row findFirst → none (A's copy is private)
    queue([{ id: "m-new", createdByUserId: "u-b" }]); // insert meals .returning
    queue([{ id: "log-1", mealId: "m-new" }]); // insert meal_logs .returning
    queue([{ value: 1 }]);

    const result = await createMealLog("u-b", "h-a", BASE_INPUT);

    // No `update meals` was queued — the drained queue proves the private
    // row was neither matched nor written.
    expect(result.mealLog).toEqual({ id: "log-1", mealId: "m-new" });
    expect(sharingMock.getGrantRole).not.toHaveBeenCalled();
  });

  it("converges on a row shared with the viewer, but a view-only grant never rewrites the recipe", async () => {
    queue(undefined); // own-row findFirst → none
    queue({ id: "m-shared", createdByUserId: "u-a", photoUrl: null }); // granted row
    sharingMock.getGrantRole.mockResolvedValue("view");
    // NO `update meals` queued — a view-only grantee's recipeText must not
    // overwrite the owner's recipe.
    queue([{ id: "log-1", mealId: "m-shared" }]);
    queue([{ value: 2 }]);

    const result = await createMealLog("u-b", "h-a", {
      ...BASE_INPUT,
      recipeText: "my own tweaks that must not clobber the owner's recipe"
    });

    expect(result.mealLog).toEqual({ id: "log-1", mealId: "m-shared" });
    expect(sharingMock.getGrantRole).toHaveBeenCalledWith("u-b", "recipe", "m-shared");
  });

  it("lets an edit-role grantee update the shared row's recipe fields", async () => {
    queue(undefined); // own-row findFirst → none
    queue({ id: "m-shared", createdByUserId: "u-a", photoUrl: null });
    sharingMock.getGrantRole.mockResolvedValue("edit");
    queue([]); // update meals — allowed for edit grants
    queue([{ id: "log-1", mealId: "m-shared" }]);
    queue([{ value: 2 }]);

    const result = await createMealLog("u-b", "h-a", {
      ...BASE_INPUT,
      recipeText: "shared-recipe update from an editor"
    });

    expect(result.mealLog).toEqual({ id: "log-1", mealId: "m-shared" });
  });
});
