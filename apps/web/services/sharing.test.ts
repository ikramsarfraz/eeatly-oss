import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FIFO-result-queue db mock — same shape as services/meals.test.ts. Each
// awaited drizzle chain dequeues the next enqueued value.
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

const notificationsMock = vi.hoisted(() => ({
  createNotification: vi.fn(async () => undefined)
}));
vi.mock("@/services/notifications", () => notificationsMock);

import { grantItem, revokeItem } from "./sharing";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  notificationsMock.createNotification.mockReset();
  notificationsMock.createNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

const itemRow = (ownerUserId: string) => [
  { ownerUserId, name: "Beef Shawarma", householdId: "h-1", archivedAt: null }
];

describe("grantItem", () => {
  it("rejects when the caller is not the item owner", async () => {
    queue(itemRow("owner-x")); // resolveItem
    await expect(
      grantItem({
        ownerUserId: "not-owner",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "grantee-1"
      })
    ).rejects.toThrow(/only the owner/i);
  });

  it("rejects granting to someone outside the sharing circle", async () => {
    queue(itemRow("me")); // resolveItem
    queue([]); // areConnected → no connection row
    await expect(
      grantItem({
        ownerUserId: "me",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "stranger"
      })
    ).rejects.toThrow(/circle/i);
  });

  it("rejects granting an item to yourself", async () => {
    await expect(
      grantItem({
        ownerUserId: "me",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "me"
      })
    ).rejects.toThrow(/already own/i);
  });
});

describe("revokeItem", () => {
  it("is a no-op when there is no active grant", async () => {
    queue(itemRow("me")); // resolveItem
    queue([]); // active-grant lookup → none
    await expect(
      revokeItem({
        ownerUserId: "me",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "grantee-1"
      })
    ).resolves.toBeUndefined();
  });

  it("revokes and writes a tombstone when an active grant exists", async () => {
    queue(itemRow("me")); // resolveItem
    queue([{ id: "g-1", savedCopyItemId: null }]); // active-grant lookup
    queue(undefined); // update grant set revoked_at
    queue([{ name: "Me", email: "me@example.com" }]); // displayName
    queue(undefined); // insert tombstone
    await expect(
      revokeItem({
        ownerUserId: "me",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "grantee-1"
      })
    ).resolves.toBeUndefined();
    // All queued DB steps consumed (resolve, lookup, update, name, tombstone).
    expect(dbState.queue.length).toBe(0);
  });
});
