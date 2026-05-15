import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Round 9 — tier-2 test for the onboarding path resolver. The helper
// is a single read on the (household_members → households) join, so we
// mock the chain to a one-shot result queue.

const dbState = vi.hoisted(() => {
  const queue: Array<unknown[]> = [];

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
            const rows = queue.shift();
            if (!rows) {
              return Promise.reject(
                new Error("dbState: queue empty — test forgot to enqueue rows.")
              ).then(onFulfilled, onRejected);
            }
            return Promise.resolve(rows).then(onFulfilled, onRejected);
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

import { resolveOnboardingPath } from "./path";

beforeEach(() => {
  dbState.queue.length = 0;
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("resolveOnboardingPath", () => {
  it("returns `fresh` when the user owns their household", async () => {
    dbState.queue.push([
      { ownerId: "u-me", householdName: "My Kitchen" }
    ]);

    const result = await resolveOnboardingPath("u-me");
    expect(result).toEqual({ path: "fresh", householdName: "My Kitchen" });
  });

  it("returns `invited` when the household is owned by someone else", async () => {
    dbState.queue.push([
      { ownerId: "u-mom", householdName: "Sara's Kitchen" }
    ]);

    const result = await resolveOnboardingPath("u-daughter");
    expect(result).toEqual({ path: "invited", householdName: "Sara's Kitchen" });
  });

  it("falls back to `fresh` with a null kitchen name when the user has no membership row", async () => {
    // Empty result — getCurrentHousehold's self-heal will create one on
    // the next request, but the resolver itself defaults to `fresh`.
    dbState.queue.push([]);

    const result = await resolveOnboardingPath("u-new");
    expect(result).toEqual({ path: "fresh", householdName: null });
  });
});
