import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FIFO-result-queue db mock — same shape as billing.test / meals.test.
const dbState = vi.hoisted(() => {
  const queue: Array<() => Promise<unknown>> = [];
  type Chain = ((...args: unknown[]) => Chain) & PromiseLike<unknown> & {
    [key: string]: unknown;
  };
  function makeChain(): Chain {
    const handler: ProxyHandler<Chain> = {
      get(_t, prop) {
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

import {
  applyTierGrant,
  getUserTier,
  grantPurchasedCredits,
  withAiCredits
} from "./ai-credits";
import { InsufficientCreditsError } from "@/lib/errors/credits";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("getUserTier", () => {
  it("returns free when there's no subscription row", async () => {
    queue([]); // subscriptions lookup → none
    expect(await getUserTier("u-1")).toBe("free");
  });

  it("returns free when the subscription isn't active", async () => {
    queue([{ status: "canceled", tier: "pro" }]);
    expect(await getUserTier("u-1")).toBe("free");
  });

  it("maps an active pro subscription to pro", async () => {
    queue([{ status: "active", tier: "pro" }]);
    expect(await getUserTier("u-1")).toBe("pro");
  });

  it("treats an active sub with a null tier as plus (legacy)", async () => {
    queue([{ status: "active", tier: null }]);
    expect(await getUserTier("u-1")).toBe("plus");
  });
});

describe("grantPurchasedCredits", () => {
  it("credits the user and is idempotent on the Stripe event id", async () => {
    queue([{ id: "ledger-1" }]); // ledger insert returning (fresh)
    queue(undefined); // ai_credits upsert (+credits)
    const first = await grantPurchasedCredits({
      userId: "u-1",
      credits: 200,
      stripeEventId: "evt_1"
    });
    expect(first).toEqual({ granted: true });

    // Replay: the ledger insert hits the unique index → no rows returned.
    queue([]); // ledger insert returning (conflict → empty)
    const second = await grantPurchasedCredits({
      userId: "u-1",
      credits: 200,
      stripeEventId: "evt_1"
    });
    expect(second).toEqual({ granted: false });
  });
});

describe("applyTierGrant", () => {
  it("is a no-op when the tier didn't increase", async () => {
    // No db calls expected — same/lower tier returns early.
    await expect(
      applyTierGrant({ userId: "u-1", oldTier: "pro", newTier: "plus" })
    ).resolves.toBeUndefined();
    expect(dbState.queue.length).toBe(0);
  });

  it("tops up the monthly bucket on an upgrade", async () => {
    queue(undefined); // ai_credits upsert (GREATEST)
    queue(undefined); // ledger insert
    await applyTierGrant({ userId: "u-1", oldTier: "free", newTier: "pro" });
    expect(dbState.queue.length).toBe(0);
  });
});

describe("withAiCredits", () => {
  it("rejects with InsufficientCreditsError when the deduct affects no row", async () => {
    queue([{ status: "active", tier: "free" }]); // getUserTier
    queue(undefined); // ensureCurrentRow: insert ... onConflictDoNothing
    queue([
      {
        userId: "u-1",
        monthlyRemaining: 0,
        monthlyPeriodStart: new Date(),
        topupRemaining: 0,
        updatedAt: new Date()
      }
    ]); // ensureCurrentRow: select row (current month)
    queue([]); // atomic deduct UPDATE ... RETURNING → 0 rows (broke)
    // getCreditBalance (for the error) re-reads: getUserTier + ensure row
    queue([{ status: "active", tier: "free" }]); // getUserTier
    queue(undefined); // insert onConflictDoNothing
    queue([
      {
        userId: "u-1",
        monthlyRemaining: 0,
        monthlyPeriodStart: new Date(),
        topupRemaining: 0,
        updatedAt: new Date()
      }
    ]); // select

    const fn = vi.fn();
    await expect(withAiCredits("u-1", "suggest_text", fn)).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it("deducts and runs fn on success", async () => {
    queue([{ status: "active", tier: "pro" }]); // getUserTier
    queue(undefined); // ensure insert
    queue([
      {
        userId: "u-1",
        monthlyRemaining: 100,
        monthlyPeriodStart: new Date(),
        topupRemaining: 0,
        updatedAt: new Date()
      }
    ]); // ensure select
    queue([{ monthlyRemaining: 99, topupRemaining: 0 }]); // atomic deduct RETURNING
    queue(undefined); // ledger consume insert

    const result = await withAiCredits("u-1", "suggest_text", async () => "ok");
    expect(result).toBe("ok");
  });
});
