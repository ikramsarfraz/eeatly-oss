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
  createNotification: vi.fn(async () => undefined),
  createNotificationIfNotRecent: vi.fn(async () => null)
}));
vi.mock("@/services/notifications", () => notificationsMock);

// User settings default to reshare-off so a non-owner can't grant.
vi.mock("@/services/user-settings", () => ({
  getUserSettings: vi.fn(async () => ({
    allowLinkShares: true,
    cooksCanReshare: false,
    whoCanAddYou: "connections",
    findByEmail: true
  }))
}));

// Co-editing (Edit/Admin grants) is gated on the owner's Pro tier via
// `requireFeatureAccess`. Default to allow; individual tests override it to
// assert the gated path. The gate logic itself is covered in resolver.test.
const gateMock = vi.hoisted(() => ({ requireFeatureAccess: vi.fn(async () => undefined) }));
vi.mock("@/lib/gates/resolver", () => gateMock);

import {
  canEditItem,
  canManageSharing,
  grantItem,
  revokeItem,
  setGrantRole
} from "./sharing";
import { FeatureGateDeniedError } from "@/lib/errors/gates";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  notificationsMock.createNotification.mockReset();
  notificationsMock.createNotification.mockResolvedValue(undefined);
  gateMock.requireFeatureAccess.mockReset();
  gateMock.requireFeatureAccess.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

const itemRow = (ownerUserId: string) => [
  { ownerUserId, name: "Beef Shawarma", householdId: "h-1", archivedAt: null }
];

describe("grantItem", () => {
  it("rejects when the caller is not the item owner (or an admin)", async () => {
    queue(itemRow("owner-x")); // resolveItem
    queue([]); // getGrantRole lookup → no grant (so the reshare path is denied)
    await expect(
      grantItem({
        ownerUserId: "not-owner",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "grantee-1"
      })
    ).rejects.toThrow(/not authorized to manage sharing/i);
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

  it("rejects granting an item to its owner", async () => {
    queue(itemRow("me")); // resolveItem — owner is "me"
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

describe("grant roles", () => {
  it("canEditItem / canManageSharing encode the role matrix", () => {
    expect(canEditItem("owner")).toBe(true);
    expect(canEditItem("admin")).toBe(true);
    expect(canEditItem("edit")).toBe(true);
    expect(canEditItem("view")).toBe(false);
    expect(canEditItem(null)).toBe(false);

    expect(canManageSharing("owner")).toBe(true);
    expect(canManageSharing("admin")).toBe(true);
    expect(canManageSharing("edit")).toBe(false);
    expect(canManageSharing("view")).toBe(false);
    expect(canManageSharing(null)).toBe(false);
  });

  it("grantItem persists the requested role when the owner shares", async () => {
    queue(itemRow("me")); // resolveItem (owner = me, so no grant lookup)
    queue([{ id: "c-1" }]); // areConnected → connected
    queue([{ grantId: "g-new" }]); // insert ... returning
    queue([{ name: "Me", email: "me@example.com" }]); // displayName (notification)

    const result = await grantItem({
      ownerUserId: "me",
      itemType: "recipe",
      itemId: "11111111-1111-4111-8111-111111111111",
      granteeUserId: "friend",
      role: "edit"
    });

    expect(result).toEqual({ grantId: "g-new" });
    expect(dbState.queue.length).toBe(0);
  });

  it("grantItem rejects an Edit grant when the owner isn't Pro (co-editing gated)", async () => {
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new FeatureGateDeniedError("co_editing")
    );
    queue(itemRow("me")); // resolveItem (owner = me)
    await expect(
      grantItem({
        ownerUserId: "me",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "friend",
        role: "edit"
      })
    ).rejects.toBeInstanceOf(FeatureGateDeniedError);
    // The gate was checked against the item's owner.
    expect(gateMock.requireFeatureAccess).toHaveBeenCalledWith("me", "co_editing");
  });

  it("grantItem allows a view-only grant without a Pro check", async () => {
    queue(itemRow("me")); // resolveItem
    queue([{ id: "c-1" }]); // areConnected → connected
    queue([{ grantId: "g-view" }]); // insert ... returning
    queue([{ name: "Me", email: "me@example.com" }]); // displayName

    const result = await grantItem({
      ownerUserId: "me",
      itemType: "recipe",
      itemId: "11111111-1111-4111-8111-111111111111",
      granteeUserId: "friend",
      role: "view"
    });

    expect(result).toEqual({ grantId: "g-view" });
    expect(gateMock.requireFeatureAccess).not.toHaveBeenCalled();
  });

  it("setGrantRole rejects a non-manager (editor can't change roles)", async () => {
    queue(itemRow("owner-x")); // resolveItem (owner is someone else)
    queue([{ role: "edit" }]); // getGrantRole(actor) → editor, not a manager

    await expect(
      setGrantRole({
        actingUserId: "an-editor",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "friend",
        role: "admin"
      })
    ).rejects.toThrow(/not authorized to manage sharing/i);
  });

  it("setGrantRole updates the grant when an admin acts", async () => {
    queue(itemRow("owner-x")); // resolveItem
    queue([{ role: "admin" }]); // getGrantRole(actor) → admin → may manage
    queue([{ id: "g-1" }]); // update ... returning (grant found)

    await expect(
      setGrantRole({
        actingUserId: "an-admin",
        itemType: "recipe",
        itemId: "11111111-1111-4111-8111-111111111111",
        granteeUserId: "friend",
        role: "edit"
      })
    ).resolves.toBeUndefined();
    expect(dbState.queue.length).toBe(0);
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
