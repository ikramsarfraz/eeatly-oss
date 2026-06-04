import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted Proxy db mock + transaction override.
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

// Credit-grant side effects are unit-tested in ai-credits.test; stub them
// here so the webhook-ingest tests stay focused on subscription persistence
// (and don't consume the FIFO db queue).
vi.mock("@/services/ai-credits", () => ({
  getUserTier: vi.fn(async () => "free"),
  applyTierGrant: vi.fn(async () => undefined),
  grantPurchasedCredits: vi.fn(async () => ({ granted: true }))
}));

// Don't load env / Stripe client at module init — neither is exercised
// by the webhook-ingest tests (they pass pre-constructed Stripe.Event
// shapes), but the import chain still pulls these modules.
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_PUBLISHABLE_KEY: "pk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    STRIPE_PRICE_MONTHLY: "price_monthly",
    STRIPE_PRICE_ANNUAL: "price_annual",
    NEXT_PUBLIC_APP_URL: "https://test.eeatly.app"
  }),
  hasStripeEnv: () => true
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => {
    throw new Error(
      "getStripeClient should not be called by webhook-ingest unit tests."
    );
  }
}));

import { ingestStripeEvent } from "./billing";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

function makeSubscriptionEvent(overrides: Partial<{
  id: string;
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted";
  subscription: Partial<{
    id: string;
    status: string;
    customer: string;
    cancel_at_period_end: boolean;
    metadata: Record<string, string>;
    items: { data: Array<{ current_period_start: number; current_period_end: number; price: { id: string } }> };
  }>;
}> = {}): unknown {
  return {
    id: overrides.id ?? "evt_test_1",
    type: overrides.type ?? "customer.subscription.created",
    data: {
      object: {
        id: overrides.subscription?.id ?? "sub_1",
        status: overrides.subscription?.status ?? "active",
        customer: overrides.subscription?.customer ?? "cus_1",
        cancel_at_period_end: overrides.subscription?.cancel_at_period_end ?? false,
        metadata: overrides.subscription?.metadata ?? { userId: "u-1" },
        items: overrides.subscription?.items ?? {
          data: [
            {
              current_period_start: 1735000000,
              current_period_end: 1737692400,
              price: { id: "price_monthly" }
            }
          ]
        }
      }
    }
  };
}

beforeEach(() => {
  dbState.queue.length = 0;
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("ingestStripeEvent — idempotency", () => {
  it("inserts a receipt and processes the event on first sight", async () => {
    queue([{ id: "evt_test_1" }]); // receipt insert .returning() — fresh row
    // upsertSubscriptionFromStripe inside the transaction:
    queue([]); // subscriptions upsert (insert ... on conflict)
    queue([]); // users update
    queue([]); // receipt .update set processedAt

    await ingestStripeEvent(
      makeSubscriptionEvent({ id: "evt_test_1" }) as Parameters<typeof ingestStripeEvent>[0]
    );

    // afterEach guard confirms exactly 4 queue items consumed.
  });

  it("skips the handler when a duplicate event id is replayed (receipt insert no-ops)", async () => {
    queue([]); // receipt insert .returning() — empty (ON CONFLICT DO NOTHING)
    // No more queue items. If the handler ran, it would attempt the
    // upsert + user update + receipt update, and the afterEach queue
    // guard would fire "queue empty — test forgot to enqueue."

    await ingestStripeEvent(
      makeSubscriptionEvent({ id: "evt_test_1" }) as Parameters<typeof ingestStripeEvent>[0]
    );
  });

  it("writes the error to the receipt row when the handler throws and rethrows for retry", async () => {
    queue([{ id: "evt_test_2" }]); // receipt insert — fresh
    // Simulate the subscription upsert throwing.
    dbState.queue.push(async () => {
      throw new Error("simulated db failure");
    });
    queue([]); // receipt .update with error

    await expect(
      ingestStripeEvent(
        makeSubscriptionEvent({ id: "evt_test_2" }) as Parameters<typeof ingestStripeEvent>[0]
      )
    ).rejects.toThrow(/simulated db failure/);
  });
});

describe("ingestStripeEvent — status mapping + period dates", () => {
  it("coerces unknown statuses to a no-op (warn-and-return, no DB writes)", async () => {
    queue([{ id: "evt_unknown_status" }]); // receipt insert — fresh
    queue([]); // receipt processed-at update — no subscription write happened

    await ingestStripeEvent(
      makeSubscriptionEvent({
        id: "evt_unknown_status",
        subscription: { status: "paused" /* not in our enum yet */ }
      }) as Parameters<typeof ingestStripeEvent>[0]
    );
  });

  it("maps an active subscription correctly (one upsert + one users update inside the transaction)", async () => {
    queue([{ id: "evt_active" }]);
    queue([]); // subscriptions upsert
    queue([]); // users update
    queue([]); // receipt processed-at

    await ingestStripeEvent(
      makeSubscriptionEvent({
        id: "evt_active",
        type: "customer.subscription.updated",
        subscription: { status: "active" }
      }) as Parameters<typeof ingestStripeEvent>[0]
    );
  });

  it("falls back to a stripeCustomerId lookup when metadata.userId is missing", async () => {
    queue([{ id: "evt_no_metadata" }]); // receipt insert
    queue([{ id: "u-found" }]); // users lookup by stripe_customer_id
    queue([]); // subscriptions upsert
    queue([]); // users update
    queue([]); // receipt processed-at

    await ingestStripeEvent(
      makeSubscriptionEvent({
        id: "evt_no_metadata",
        subscription: { metadata: {} }
      }) as Parameters<typeof ingestStripeEvent>[0]
    );
  });

  it("logs and returns when user can't be resolved (no metadata, no users row)", async () => {
    queue([{ id: "evt_orphan" }]); // receipt insert
    queue([]); // users lookup — no rows
    // No mutation queue items; service returns early.
    queue([]); // receipt processed-at

    await ingestStripeEvent(
      makeSubscriptionEvent({
        id: "evt_orphan",
        subscription: { metadata: {} }
      }) as Parameters<typeof ingestStripeEvent>[0]
    );
  });
});

describe("ingestStripeEvent — unhandled event types", () => {
  it("records a receipt + marks processed for events we don't handle", async () => {
    queue([{ id: "evt_unhandled" }]); // receipt insert
    queue([]); // receipt processed-at (no handler ran)

    const unknownEvent = {
      id: "evt_unhandled",
      type: "ping.something",
      data: { object: {} }
    };

    await ingestStripeEvent(unknownEvent as Parameters<typeof ingestStripeEvent>[0]);
  });
});
