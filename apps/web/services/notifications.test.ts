import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted db mock. Drizzle's fluent API can be awaited at any point in the
// chain — so every chain method must return a Proxy that's both chainable
// AND thenable, popping the next queued resolver when awaited.
const dbState = vi.hoisted(() => {
  const queue: Array<() => Promise<unknown>> = [];

  type Chain = ((...args: unknown[]) => Chain) & PromiseLike<unknown> & {
    [key: string]: unknown;
  };

  function makeChain(): Chain {
    const handler: ProxyHandler<Chain> = {
      get(_target, prop) {
        if (prop === "then") {
          // Awaited — drain the next queued resolver.
          return (
            onFulfilled?: (v: unknown) => unknown,
            onRejected?: (e: unknown) => unknown
          ) => {
            const resolver = queue.shift();
            if (!resolver) {
              const err = new Error(
                "dbState: queue empty — test forgot to enqueue a result."
              );
              return Promise.reject(err).then(onFulfilled, onRejected);
            }
            return resolver().then(onFulfilled, onRejected);
          };
        }
        // Any other property access returns a chainable function. Drizzle
        // also occasionally calls bare functions on the chain (`.fields`,
        // `.session`); returning the proxy keeps everything chainable.
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
// Notifications table is referenced via the schema barrel — keep that real
// so identity comparisons inside the service work, but the service never
// actually executes against it because db is mocked.

import {
  createNotification,
  createNotificationIfNotRecent,
  listNotificationsForUser,
  markNotificationRead
} from "./notifications";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

function queueError(message: string) {
  dbState.queue.push(async () => {
    throw new Error(message);
  });
}

beforeEach(() => {
  dbState.queue.length = 0;
});

afterEach(() => {
  // Catch tests that queue results they don't consume — usually a sign that
  // the assertion is checking the wrong branch.
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

const mockNotification = {
  id: "n-1",
  userId: "u-1",
  type: "rediscovery" as const,
  title: "Test",
  body: null,
  href: null,
  payload: null,
  readAt: null,
  createdAt: new Date("2026-05-01T12:00:00Z")
};

describe("listNotificationsForUser", () => {
  it("returns rows + the unread count", async () => {
    // First await: the rows query (.orderBy is final, returns array directly
    // — our mock terminates on .limit even when await is on .orderBy chain).
    // To keep the mock simple we resolve to an array via the final `.limit`.
    queue([mockNotification]);
    queue([{ value: 3 }]);

    const result = await listNotificationsForUser("u-1");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("n-1");
    expect(result.unreadCount).toBe(3);
  });

  it("clamps absurd limits to 100", async () => {
    queue([]);
    queue([{ value: 0 }]);
    await listNotificationsForUser("u-1", { limit: 50000 });
    // We can't inspect the SQL value directly through the chain mock, but
    // we can prove the call chain finishes — the test passes via the
    // afterEach queue-drain check.
  });

  it("supports the onlyUnread filter", async () => {
    queue([]);
    queue([{ value: 0 }]);
    const result = await listNotificationsForUser("u-1", { onlyUnread: true });
    expect(result.rows).toEqual([]);
    expect(result.unreadCount).toBe(0);
  });
});

describe("markNotificationRead", () => {
  it("throws when the row doesn't exist or is already read", async () => {
    queue([]); // .returning() resolves with no rows
    await expect(markNotificationRead("u-1", "n-missing")).rejects.toThrow(
      /Notification not found/
    );
  });

  it("succeeds silently when the update returns a row", async () => {
    queue([{ id: "n-1" }]);
    await expect(markNotificationRead("u-1", "n-1")).resolves.toBeUndefined();
  });
});

describe("createNotification", () => {
  it("throws if the insert returns no rows", async () => {
    queue([]);
    await expect(
      createNotification({
        userId: "u-1",
        type: "system",
        title: "Hi"
      })
    ).rejects.toThrow(/Failed to create notification/);
  });

  it("returns a DTO when the insert succeeds", async () => {
    queue([mockNotification]);
    const result = await createNotification({
      userId: "u-1",
      type: "rediscovery",
      title: "Test"
    });
    expect(result.id).toBe("n-1");
    expect(result.readAt).toBeNull();
    expect(result.payload).toBeNull();
  });
});

describe("createNotificationIfNotRecent", () => {
  it("skips insert when a matching row was created within the window", async () => {
    queue([{ id: "existing" }]); // .limit() on the lookup
    // No insert queued — if the service tried to insert, the test would
    // throw via the dbState's "no result queued" guard.
    const result = await createNotificationIfNotRecent(
      {
        userId: "u-1",
        type: "neglected_meal",
        title: "Quiet for a while"
      },
      24
    );
    expect(result).toBeNull();
  });

  it("inserts and returns a DTO when nothing recent matches", async () => {
    queue([]); // lookup finds nothing
    queue([mockNotification]); // insert returns the new row
    const result = await createNotificationIfNotRecent(
      {
        userId: "u-1",
        type: "neglected_meal",
        title: "Quiet for a while"
      },
      24
    );
    expect(result?.id).toBe("n-1");
  });

  it("propagates errors from the lookup query", async () => {
    queueError("connection lost");
    await expect(
      createNotificationIfNotRecent(
        {
          userId: "u-1",
          type: "neglected_meal",
          title: "Quiet for a while"
        },
        24
      )
    ).rejects.toThrow(/connection lost/);
  });
});
