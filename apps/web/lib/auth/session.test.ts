import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Proxy db mock — same shape as the service tests. requireHouseholdOwner
// does exactly one query (household row by id), so the queue is short.
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
        return () => proxy;
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

// session.ts imports `auth` from lib/auth/index.ts which calls getServerEnv()
// at module load. Short-circuit the env validation chain. The mock surface
// only needs `auth` to exist; the helpers under test don't use it.
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

// services/households.ts imports back into session via requireHouseholdMember
// — short-circuit ensureHouseholdForUser since requireHouseholdOwner doesn't
// touch it.
vi.mock("@/services/households", () => ({
  ensureHouseholdForUser: async () => ({ id: "h-stub", name: "Stub", created: false })
}));

import { requireHouseholdOwner } from "./session";
import { NotHouseholdOwnerError } from "@/lib/errors/households";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("requireHouseholdOwner", () => {
  it("passes when the user is the household owner", async () => {
    queue([{ ownerId: "u-owner" }]);
    await expect(requireHouseholdOwner("u-owner", "h-a")).resolves.toBeUndefined();
  });

  it("throws NotHouseholdOwnerError when the user is a non-owner member", async () => {
    queue([{ ownerId: "u-someone-else" }]);
    await expect(requireHouseholdOwner("u-member", "h-a")).rejects.toBeInstanceOf(
      NotHouseholdOwnerError
    );
  });

  it("throws NotHouseholdOwnerError when the household doesn't exist", async () => {
    queue([]); // .limit(1) returns no rows
    await expect(requireHouseholdOwner("u-anyone", "h-missing")).rejects.toBeInstanceOf(
      NotHouseholdOwnerError
    );
  });
});
