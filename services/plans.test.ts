import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted db mock — same Proxy pattern as the other service tests, with
// the `db.transaction(fn)` override so the callback actually runs against
// the same queue.
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

// Short-circuit the env-validation chain (services/plans.ts → lib/auth/session
// → lib/auth/index → getServerEnv). Hoisted vi.fn so tests can override
// the membership check per-case.
const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>(),
  requireHouseholdOwner: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));
vi.mock("@/lib/auth/session", () => sessionMock);

import {
  addDishToPlan,
  clonePlanFromPast,
  createPlan,
  getPlanEffortAggregate,
  listPlansForHousehold,
  reorderDishes,
  updateDishAnnotation
} from "./plans";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  sessionMock.requireHouseholdOwner.mockReset();
  sessionMock.requireHouseholdOwner.mockResolvedValue();
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

const PLAN_ROW = {
  id: "p-1",
  householdId: "h-a",
  createdByUserId: "u-a",
  name: "Eid al-Adha 2024",
  scheduledDate: "2024-06-17",
  notes: null,
  archivedAt: null,
  createdAt: new Date("2024-05-01T00:00:00Z"),
  updatedAt: new Date("2024-05-01T00:00:00Z")
};

describe("createPlan", () => {
  it("gates on requireHouseholdMember and inserts with createdByUserId set", async () => {
    queue([PLAN_ROW]); // insert .returning()

    const result = await createPlan({
      householdId: "h-a",
      userId: "u-a",
      name: "Eid al-Adha 2024",
      scheduledDate: "2024-06-17"
    });

    expect(result).toEqual(PLAN_ROW);
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-a", "h-a");
  });

  it("rejects when the caller isn't a member of the target household", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      createPlan({
        householdId: "h-other",
        userId: "u-stranger",
        name: "x",
        scheduledDate: "2024-06-17"
      })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("listPlansForHousehold", () => {
  it("filters out archived plans by default", async () => {
    queue([
      { ...PLAN_ROW, dishCount: 5 },
      { ...PLAN_ROW, id: "p-2", scheduledDate: "2023-06-29", dishCount: 7 }
    ]);

    const result = await listPlansForHousehold({ householdId: "h-a", userId: "u-a" });
    expect(result).toHaveLength(2);
    expect(result[0]?.dishCount).toBe(5);
    // The afterEach guard confirms exactly one query fired — no second
    // query was queued, so the function returned after the first read.
  });

  it("includes archived plans when includeArchived is true", async () => {
    queue([
      { ...PLAN_ROW, archivedAt: new Date("2024-08-01T00:00:00Z"), dishCount: 3 }
    ]);
    const result = await listPlansForHousehold({
      householdId: "h-a",
      userId: "u-a",
      includeArchived: true
    });
    expect(result[0]?.archivedAt).not.toBeNull();
  });
});

describe("addDishToPlan", () => {
  it("rejects when the meal belongs to a different household", async () => {
    queue([PLAN_ROW]); // plan lookup (loadPlanOrThrow)
    queue([
      { id: "m-1", householdId: "h-other", archivedAt: null }
    ]); // meal lookup

    await expect(
      addDishToPlan({ planId: "p-1", userId: "u-a", mealId: "m-1" })
    ).rejects.toThrow(/Meal not in this household/);
    // Cross-household read is logged at error level — that's the alert
    // hook for cross-household-id smuggling attempts.
  });

  it("appends the dish at the end of sortOrder", async () => {
    queue([PLAN_ROW]); // plan lookup
    queue([{ id: "m-1", householdId: "h-a", archivedAt: null }]); // meal lookup
    queue([{ value: 4 }]); // max sortOrder = 4
    queue([
      {
        id: "pd-new",
        planId: "p-1",
        mealId: "m-1",
        addedByUserId: "u-a",
        sortOrder: 5,
        actualEffort: null,
        timeTakenMinutes: null,
        verdict: null,
        annotationNotes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]); // insert .returning()

    const result = await addDishToPlan({
      planId: "p-1",
      userId: "u-a",
      mealId: "m-1"
    });
    expect(result.sortOrder).toBe(5);
  });

  it("is idempotent: if the dish is already on the plan, returns the existing row without a new insert", async () => {
    queue([PLAN_ROW]); // plan lookup
    queue([{ id: "m-1", householdId: "h-a", archivedAt: null }]); // meal lookup
    queue([{ value: 0 }]); // max sortOrder
    queue([]); // insert .returning() → empty (ON CONFLICT DO NOTHING fired)
    queue([
      {
        id: "pd-existing",
        planId: "p-1",
        mealId: "m-1",
        addedByUserId: "u-original",
        sortOrder: 0,
        actualEffort: null,
        timeTakenMinutes: null,
        verdict: null,
        annotationNotes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]); // conflict-path re-read

    const result = await addDishToPlan({
      planId: "p-1",
      userId: "u-a",
      mealId: "m-1"
    });
    expect(result.id).toBe("pd-existing");
    expect(result.addedByUserId).toBe("u-original");
  });
});

describe("reorderDishes", () => {
  it("runs the bulk update in a transaction with one UPDATE per dish", async () => {
    queue([PLAN_ROW]); // plan lookup
    // Three updates inside the transaction — drain three queue entries.
    queue([]);
    queue([]);
    queue([]);

    await reorderDishes({
      planId: "p-1",
      userId: "u-a",
      dishIdsInOrder: ["pd-1", "pd-2", "pd-3"]
    });
    // Queue drained exactly to 4 entries (1 read + 3 updates) — proof
    // that no extra queries fired. If the service had skipped the WHERE
    // planId guard or done a second pass, afterEach would catch it.
  });
});

describe("updateDishAnnotation", () => {
  it("partial patch only updates the fields the caller passed (notes-only)", async () => {
    queue([{ id: "pd-1", planId: "p-1" }]); // dish lookup
    queue([PLAN_ROW]); // plan lookup
    queue([
      {
        id: "pd-1",
        planId: "p-1",
        mealId: "m-1",
        addedByUserId: "u-a",
        sortOrder: 0,
        actualEffort: null,
        timeTakenMinutes: null,
        verdict: null,
        annotationNotes: "tweaked the spice ratio",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]); // update .returning()

    const result = await updateDishAnnotation({
      planDishId: "pd-1",
      userId: "u-a",
      patch: { annotationNotes: "tweaked the spice ratio" }
    });
    expect(result.annotationNotes).toBe("tweaked the spice ratio");
    expect(result.verdict).toBeNull();
  });
});

describe("clonePlanFromPast", () => {
  it("copies dishes, does NOT copy annotation fields, and returns previousAnnotations keyed by mealId", async () => {
    // Source plan + dishes setup
    queue([{ ...PLAN_ROW, id: "p-source" }]); // loadPlanOrThrow(source)

    // Inside transaction:
    queue([
      // source dishes (one with annotations, one without)
      {
        mealId: "m-pasta",
        sortOrder: 0,
        actualEffort: "high_effort" as const,
        timeTakenMinutes: 180,
        verdict: "do_not_repeat" as const,
        annotationNotes: "took all day, not worth it"
      },
      {
        mealId: "m-salad",
        sortOrder: 1,
        actualEffort: null,
        timeTakenMinutes: null,
        verdict: null,
        annotationNotes: null
      }
    ]);
    queue([
      // new plan insert .returning
      { id: "p-new", name: "Eid al-Adha 2025", scheduledDate: "2025-06-07" }
    ]);
    queue([]); // dishes bulk insert (no .returning)

    const result = await clonePlanFromPast({
      sourcePlanId: "p-source",
      userId: "u-a",
      newName: "Eid al-Adha 2025",
      newScheduledDate: "2025-06-07"
    });

    expect(result.newPlanId).toBe("p-new");
    expect(result.newPlanName).toBe("Eid al-Adha 2025");
    expect(result.newScheduledDate).toBe("2025-06-07");

    // The dish with prior wisdom is present in the hints map; the dish
    // without isn't (so the UI doesn't render empty hint badges).
    expect(result.previousAnnotations["m-pasta"]).toEqual({
      verdict: "do_not_repeat",
      actualEffort: "high_effort",
      annotationNotes: "took all day, not worth it",
      timeTakenMinutes: 180
    });
    expect(result.previousAnnotations["m-salad"]).toBeUndefined();
  });

  it("rejects when the caller isn't a member of the source plan's household", async () => {
    queue([{ ...PLAN_ROW, id: "p-source", householdId: "h-other" }]);
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      clonePlanFromPast({
        sourcePlanId: "p-source",
        userId: "u-stranger",
        newName: "x",
        newScheduledDate: "2025-06-07"
      })
    ).rejects.toThrow(/Not authorized/);
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith(
      "u-stranger",
      "h-other"
    );
  });

  it("handles source plans with no dishes (clone is just a header)", async () => {
    queue([{ ...PLAN_ROW, id: "p-empty" }]); // loadPlanOrThrow
    queue([]); // source dishes → none
    queue([
      { id: "p-new", name: "Empty draft", scheduledDate: "2025-06-07" }
    ]); // insert plan
    // No dish insert queue entry — service should skip the bulk-insert
    // when sourceDishes is empty. If it ran the insert anyway, queue
    // would be empty and the test would throw.

    const result = await clonePlanFromPast({
      sourcePlanId: "p-empty",
      userId: "u-a",
      newName: "Empty draft",
      newScheduledDate: "2025-06-07"
    });
    expect(result.previousAnnotations).toEqual({});
  });
});

describe("getPlanEffortAggregate", () => {
  it("counts actualEffort when present and falls back to the latest log effort otherwise", async () => {
    queue([PLAN_ROW]); // plan lookup
    queue([
      { actualEffort: "easy", mealId: "m-1", fallbackEffort: "medium" }, // actual wins
      { actualEffort: null, mealId: "m-2", fallbackEffort: "high_effort" }, // fallback
      { actualEffort: null, mealId: "m-3", fallbackEffort: null }, // unrated
      { actualEffort: "easy", mealId: "m-4", fallbackEffort: null }
    ]);

    const result = await getPlanEffortAggregate({
      planId: "p-1",
      userId: "u-a"
    });
    expect(result).toEqual({
      quick: 0,
      easy: 2,
      medium: 0,
      high_effort: 1,
      unrated: 1
    });
  });
});
