import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Proxy db mock — same shape as services/households.test.ts. No transactions
// in services/ai.ts so the transaction-callback override isn't needed.
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
        // Return proxy directly (not `() => proxy`) so the `db.query.X.findFirst`
        // pattern works the same as `db.select(...).from(...)`. The proxy is
        // both callable (via apply) AND has gettable properties — both walks
        // converge on the same drainable promise.
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

// Short-circuit lib/auth/index.ts env validation (services/ai.ts imports
// requireHouseholdMember which transitively pulls auth/index.ts at module
// load). The auth mock is for module-load only; the session mock is the
// surface this test actually exercises.
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));

vi.mock("@/lib/auth/session", () => sessionMock);

// withFallback returns whatever the primary resolves to — short-circuit it
// so this test doesn't reach the OpenAI/Anthropic providers (and so this
// test doesn't need OPENAI_API_KEY). We don't exercise the provider path
// here; lib/ai/providers/index.test.ts owns that.
vi.mock("@/lib/ai/providers", () => ({
  withFallback: vi.fn(async (primary: () => Promise<unknown>) => primary())
}));

vi.mock("@/lib/ai/providers/openai", () => ({
  generateShareText: vi.fn(async () => ({ text: "share text" }))
}));

vi.mock("@/lib/ai/providers/anthropic", () => ({
  generateShareText: vi.fn(async () => ({ text: "share text" }))
}));

import { generateShareableRecipe } from "./ai";

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

describe("generateShareableRecipe service-layer authz", () => {
  it("calls requireHouseholdMember before touching the meal", async () => {
    // Mock will reject — the meal lookup queue should remain untouched.
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      generateShareableRecipe("u-stranger", "h-other", "m-1")
    ).rejects.toThrow(/Not authorized/);

    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-stranger", "h-other");
    // If the service had skipped the gate and reached the meal lookup,
    // afterEach would catch the queue mismatch — but additionally:
    expect(dbState.queue).toHaveLength(0);
  });

  it("permits the meal lookup when the member check passes", async () => {
    // Two reads: meal + household join, then the latest log lookup.
    queue([
      {
        id: "m-1",
        name: "Soy ginger noodles",
        recipeText: "ingredients...\n\nsteps...",
        householdName: "Test Kitchen"
      }
    ]);
    queue(undefined); // latest log .findFirst returns undefined when no logs

    const result = await generateShareableRecipe("u-member", "h-a", "m-1");

    expect(result).toEqual({ ok: true, text: "share text" });
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-member", "h-a");
  });
});
