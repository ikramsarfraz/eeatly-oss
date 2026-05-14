import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted db mock. Same Proxy-chain-with-queue pattern as
// notifications.test.ts, with one extension: `db.transaction(fn)` invokes
// `fn(proxy)` rather than returning the proxy. Without this override the
// transaction body never runs and the queue would stay full.
//
// Bounded gap (flagged in the Round 4.5 spec): this proxy doesn't model
// the DB's atomicity — a queued error from a write inside the transaction
// does NOT roll back the queue's prior writes. We work around this by only
// running tests up to the throw and asserting "no further queue drains"
// via the afterEach guard. The collision pre-flight test in particular
// verifies "no data was modified" by checking that the service never
// reached the update/delete queries (the queue would have been drained
// dry if it had).
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
              const err = new Error(
                "dbState: queue empty — test forgot to enqueue a result."
              );
              return Promise.reject(err).then(onFulfilled, onRejected);
            }
            return resolver().then(onFulfilled, onRejected);
          };
        }
        if (prop === "transaction") {
          // Invoke the callback with the proxy as the tx handle so that
          // every tx.<query>(...) inside it goes through the same queue.
          return (fn: (tx: Chain) => Promise<unknown> | unknown) =>
            Promise.resolve().then(() => fn(proxy));
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

// Round 4.7: services/households.ts now imports requireHouseholdMember
// from lib/auth/session.ts, which transitively loads lib/auth/index.ts
// and triggers getServerEnv() at module init. Short-circuit the env
// check with a session mock. Using hoisted vi.fn so individual tests
// can override the helpers' behavior (e.g., simulate unauthorized).
const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>(),
  requireHouseholdOwner: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));

vi.mock("@/lib/auth/session", () => sessionMock);

import {
  acceptHouseholdInvitation,
  countHouseholdMembers,
  ensureHouseholdForUser,
  listHouseholdMembers,
  listPendingInvitations,
  removeMemberFromHousehold
} from "./households";
import {
  CannotRemoveSelfError,
  MealNameCollisionError,
  NotHouseholdOwnerError,
  NotMemberError,
  OwnershipTransferRequiredError
} from "@/lib/errors/households";

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
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  sessionMock.requireHouseholdOwner.mockReset();
  sessionMock.requireHouseholdOwner.mockResolvedValue();
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

const FUTURE = new Date("2026-05-20T20:00:00Z");

function makeInvitation(overrides: Partial<{
  id: string;
  householdId: string;
  email: string;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? "inv-1",
    householdId: overrides.householdId ?? "h-a",
    email: overrides.email ?? "b@example.com",
    invitedByUserId: overrides.invitedByUserId ?? "u-a",
    expiresAt: overrides.expiresAt ?? FUTURE,
    acceptedAt: overrides.acceptedAt ?? null
  };
}

describe("acceptHouseholdInvitation rejects on meal name collision before any data change", () => {
  it("throws MealNameCollisionError with the colliding names and performs no writes", async () => {
    // Queue order mirrors the service's read sequence inside the
    // transaction:
    //   1. invitation lookup (validate)
    //   2. user email lookup (match check)
    //   3. current membership lookup (B is sole owner of h-b)
    //   4. other-members count (B has none → willDeleteOldHousehold = true)
    //   5. user's meals in their household
    //   6. target household's matching normalized names → COLLISION
    queue([makeInvitation()]);
    queue([{ email: "b@example.com" }]);
    queue([{ householdId: "h-b", role: "owner" }]);
    queue([{ value: 0 }]);
    queue([
      { name: "Pasta", normalizedName: "pasta" },
      { name: "Biryani", normalizedName: "biryani" }
    ]);
    queue([{ normalizedName: "pasta" }]);

    await expect(
      acceptHouseholdInvitation("u-b", "tok-123456789012345678901234567890")
    ).rejects.toBeInstanceOf(MealNameCollisionError);

    // The queue having been fully drained at this exact point (afterEach
    // asserts length 0) proves the service threw before any of the
    // mutation queries (.update meals, .update mealLogs, .delete member,
    // .delete household, .insert member, .update preferred, .update
    // invitation accepted) ran. If any had been attempted, the proxy
    // would have rejected with "queue empty".
  });

  it("exposes the colliding meal names via the typed error", async () => {
    queue([makeInvitation()]);
    queue([{ email: "b@example.com" }]);
    queue([{ householdId: "h-b", role: "owner" }]);
    queue([{ value: 0 }]);
    queue([
      { name: "Pasta", normalizedName: "pasta" },
      { name: "Biryani", normalizedName: "biryani" }
    ]);
    queue([
      { normalizedName: "pasta" },
      { normalizedName: "biryani" }
    ]);

    try {
      await acceptHouseholdInvitation("u-b", "tok-123456789012345678901234567890");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MealNameCollisionError);
      const err = error as MealNameCollisionError;
      expect([...err.collidingNames].sort()).toEqual(["Biryani", "Pasta"]);
    }
  });
});

describe("acceptHouseholdInvitation sole-owner cleanup", () => {
  it("moves meals + logs, deletes the empty old household, and reparents the user", async () => {
    // Reads (1-6)
    queue([makeInvitation()]);
    queue([{ email: "b@example.com" }]);
    queue([{ householdId: "h-b", role: "owner" }]);
    queue([{ value: 0 }]); // B has no other members
    queue([
      { name: "Lasagna", normalizedName: "lasagna" },
      { name: "Biryani", normalizedName: "biryani" }
    ]);
    queue([]); // No collisions in target

    // Writes (7-13)
    queue([{ id: "m1" }, { id: "m2" }]); // .update meals .returning
    queue([{ id: "l1" }, { id: "l2" }, { id: "l3" }]); // .update mealLogs .returning
    queue([]); // .delete old member
    queue([]); // .delete old household (willDeleteOldHousehold = true)
    queue([]); // .insert new member
    queue([]); // .update users.preferred_household_id
    queue([]); // .update invitation accepted

    // Final reads for the result payload (14-15)
    queue([{ name: "A's Kitchen" }]);
    queue([{ email: "a@example.com", name: "Alice" }]);

    const result = await acceptHouseholdInvitation(
      "u-b",
      "tok-123456789012345678901234567890"
    );

    expect(result.newHouseholdId).toBe("h-a");
    expect(result.newHouseholdName).toBe("A's Kitchen");
    expect(result.inviterUserId).toBe("u-a");
    expect(result.inviterEmail).toBe("a@example.com");
    expect(result.mealsMoved).toBe(2);
    expect(result.logsMoved).toBe(3);
  });

  it("throws OWNERSHIP_TRANSFER_REQUIRED when the joining user owns a multi-member household", async () => {
    queue([makeInvitation()]);
    queue([{ email: "b@example.com" }]);
    queue([{ householdId: "h-b", role: "owner" }]);
    queue([{ value: 2 }]); // B has other members → cannot delete h-b silently

    await expect(
      acceptHouseholdInvitation("u-b", "tok-123456789012345678901234567890")
    ).rejects.toBeInstanceOf(OwnershipTransferRequiredError);

    // Queue drained to the throw — no collision pre-flight, no
    // mutations attempted.
  });
});

describe("ensureHouseholdForUser", () => {
  it("returns the existing household without creating when membership already exists", async () => {
    queue([{ id: "h-existing", name: "Alex’s Kitchen" }]); // fast-path read

    const result = await ensureHouseholdForUser("u-1", "Alex");

    expect(result).toEqual({
      id: "h-existing",
      name: "Alex’s Kitchen",
      created: false
    });
  });

  it("creates a household + membership + preferred pointer in one transaction when none exists", async () => {
    queue([]); // fast-path read returns nothing
    queue([{ id: "h-new", name: "Alex’s Kitchen" }]); // insert households returning
    queue([]); // insert household_members
    queue([]); // update users.preferred_household_id

    const result = await ensureHouseholdForUser("u-1", "Alex");

    expect(result).toEqual({
      id: "h-new",
      name: "Alex’s Kitchen",
      created: true
    });
  });

  it("falls back to 'My Kitchen' when no display name is available", async () => {
    queue([]); // fast-path
    queue([{ id: "h-new", name: "My Kitchen" }]);
    queue([]);
    queue([]);

    const result = await ensureHouseholdForUser("u-1", null);

    expect(result.name).toBe("My Kitchen");
    expect(result.created).toBe(true);
  });

  it("re-reads the winning row when a concurrent caller wins the unique-index race", async () => {
    queue([]); // fast-path: nothing
    queueError("duplicate key value violates unique constraint"); // transactional insert throws on the race
    queue([{ id: "h-winner", name: "Alex’s Kitchen" }]); // catch path re-reads, sees the winning row

    const result = await ensureHouseholdForUser("u-1", "Alex");

    // The catch path treats a post-throw read that finds the row as the
    // race-recovery signal. The race winner's record is returned with
    // `created: false` so the caller can't mistakenly think they made it.
    expect(result).toEqual({
      id: "h-winner",
      name: "Alex’s Kitchen",
      created: false
    });
  });

  it("rethrows when the insert fails for a non-race reason (catch path re-read finds nothing)", async () => {
    queue([]); // fast-path
    queueError("connection lost"); // not a race — real failure
    queue([]); // catch path re-reads, still no row

    await expect(ensureHouseholdForUser("u-1", "Alex")).rejects.toThrow(/connection lost/);
  });
});

describe("removeMemberFromHousehold", () => {
  it("happy path: owner removes a non-owner member; row deleted and preferred pointer cleared", async () => {
    queue([{ id: "h-a", name: "Alex's Kitchen", ownerId: "u-owner" }]); // household lookup
    queue([{ memberId: "m-1", name: "Bob", email: "bob@x.com" }]); // target lookup
    queue([]); // delete household_members row
    queue([]); // update users.preferred_household_id = NULL

    const result = await removeMemberFromHousehold("u-owner", "u-bob", "h-a");

    expect(result).toEqual({
      removedUserId: "u-bob",
      removedUserName: "Bob",
      removedUserEmail: "bob@x.com",
      householdName: "Alex's Kitchen"
    });
  });

  it("throws CannotRemoveSelfError when the actor is the target", async () => {
    queue([{ id: "h-a", name: "Alex's Kitchen", ownerId: "u-owner" }]);

    await expect(
      removeMemberFromHousehold("u-owner", "u-owner", "h-a")
    ).rejects.toBeInstanceOf(CannotRemoveSelfError);

    // Queue drained at the throw — no member lookup or mutation attempted.
  });

  it("throws NotHouseholdOwnerError when the actor isn't the owner", async () => {
    queue([{ id: "h-a", name: "Alex's Kitchen", ownerId: "u-owner" }]);

    await expect(
      removeMemberFromHousehold("u-someone-else", "u-bob", "h-a")
    ).rejects.toBeInstanceOf(NotHouseholdOwnerError);
  });

  it("throws NotMemberError when the target isn't a current member", async () => {
    queue([{ id: "h-a", name: "Alex's Kitchen", ownerId: "u-owner" }]);
    queue([]); // target membership lookup finds nothing

    await expect(
      removeMemberFromHousehold("u-owner", "u-ghost", "h-a")
    ).rejects.toBeInstanceOf(NotMemberError);
  });

  it("throws NotHouseholdOwnerError when the household doesn't exist", async () => {
    queue([]); // household lookup returns no row

    await expect(
      removeMemberFromHousehold("u-owner", "u-bob", "h-missing")
    ).rejects.toBeInstanceOf(NotHouseholdOwnerError);
  });

  // Note: the `CannotRemoveOwnerError` branch in `removeMemberFromHousehold`
  // is structurally unreachable as the service is written today — actor
  // ownership is verified by comparing actor against household.ownerId, so
  // by the time the owner check runs, actor === owner; if target === owner,
  // then target === actor and the CANNOT_REMOVE_SELF branch fires first.
  // The typed error class is kept as forward-defense for a future admin
  // role that could remove members. Covered by code review.
});

describe("Round 4.7 service-layer authz checks", () => {
  it("countHouseholdMembers calls requireHouseholdMember and rejects when unauthorized", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(countHouseholdMembers("u-stranger", "h-a")).rejects.toThrow(
      /Not authorized/
    );
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-stranger", "h-a");
  });

  it("listHouseholdMembers calls requireHouseholdMember and rejects when unauthorized", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(listHouseholdMembers("u-stranger", "h-a")).rejects.toThrow(
      /Not authorized/
    );
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-stranger", "h-a");
  });

  it("listPendingInvitations calls requireHouseholdMember and rejects when unauthorized", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(listPendingInvitations("u-stranger", "h-a")).rejects.toThrow(
      /Not authorized/
    );
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-stranger", "h-a");
  });

  it("countHouseholdMembers returns the count when authorized", async () => {
    // requireHouseholdMember mock resolves by default in beforeEach.
    queue([{ value: 3 }]);
    const result = await countHouseholdMembers("u-member", "h-a");
    expect(result).toBe(3);
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-member", "h-a");
  });
});


