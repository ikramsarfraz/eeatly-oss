import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted Proxy db mock — same shape as services/*.test.ts.
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

// Logger short-circuit; we don't assert on debug lines here, just want to
// avoid noisy console output in CI.
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined }
}));

// The resolver reads the launch-promo flag from env. Mock it so the
// precedence tests below run with the promo OFF (the normal gated
// behavior); the launch-mode block flips it on per-test.
const launchFreeAccess = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/env/server", () => ({
  isLaunchFreeAccess: () => launchFreeAccess.value
}));

import { can } from "./resolver";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  launchFreeAccess.value = false;
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("can() — precedence walk", () => {
  it("admin role short-circuits before any override or default-rule evaluation", async () => {
    queue([{ id: "u-1", role: "platform_admin", betaCohort: null }]);
    // No override or rule query queued — admin should resolve from the
    // user-context load alone. If the resolver did a redundant query,
    // afterEach would catch it.

    const allowed = await can("u-1", "ai_share_recipe");
    expect(allowed).toBe(true);
  });

  it("denies a non-admin, non-beta, non-paid user against the beta_or_paid default", async () => {
    queue([{ id: "u-2", role: "root_app_user", betaCohort: null }]);
    queue([]); // override lookup → no rows
    const allowed = await can("u-2", "ai_share_recipe");
    expect(allowed).toBe(false);
  });

  it("allows beta cohort against beta_or_paid default", async () => {
    queue([{ id: "u-3", role: "root_app_user", betaCohort: "beta_2026" }]);
    queue([]); // override lookup → no rows
    const allowed = await can("u-3", "ai_share_recipe");
    expect(allowed).toBe(true);
  });

  it("per-user override (rule: open) lets a non-beta non-paid user through", async () => {
    queue([{ id: "u-4", role: "root_app_user", betaCohort: null }]);
    // One row matching userId, ruleOverride: open
    queue([
      {
        userId: "u-4",
        cohort: null,
        ruleOverride: "open"
      }
    ]);
    const allowed = await can("u-4", "ai_share_recipe");
    expect(allowed).toBe(true);
  });

  it("per-user override (rule: paid_only) overrides the cohort-derived default", async () => {
    // The user IS in beta_2026 (default rule would allow), but the
    // user-targeted override pins them to paid_only and they have no
    // subscription — so they're denied. This pins precedence:
    // user-override wins over default-from-cohort.
    queue([{ id: "u-5", role: "root_app_user", betaCohort: "beta_2026" }]);
    queue([
      {
        userId: "u-5",
        cohort: null,
        ruleOverride: "paid_only"
      }
    ]);
    const allowed = await can("u-5", "ai_share_recipe");
    expect(allowed).toBe(false);
  });

  it("per-user override beats per-cohort override when both exist", async () => {
    // User is in beta_2026 cohort. Two override rows queued: cohort-row
    // says open, user-row says paid_only. The resolver picks the
    // user-row, so the user (with no subscription) is denied.
    queue([{ id: "u-6", role: "root_app_user", betaCohort: "beta_2026" }]);
    queue([
      { userId: "u-6", cohort: null, ruleOverride: "paid_only" },
      { userId: null, cohort: "beta_2026", ruleOverride: "open" }
    ]);
    const allowed = await can("u-6", "ai_share_recipe");
    expect(allowed).toBe(false);
  });

  it("cohort override applies when no per-user override exists", async () => {
    queue([{ id: "u-7", role: "root_app_user", betaCohort: "beta_2026" }]);
    queue([{ userId: null, cohort: "beta_2026", ruleOverride: "paid_only" }]);
    // The cohort-override pins to paid_only; user has no sub → denied,
    // even though the default rule (beta_or_paid) would have allowed via
    // the cohort.
    const allowed = await can("u-7", "ai_share_recipe");
    expect(allowed).toBe(false);
  });

  it("falls back to default rule when no overrides exist and user is in cohort", async () => {
    queue([{ id: "u-8", role: "root_app_user", betaCohort: "beta_2026" }]);
    queue([]); // no overrides
    const allowed = await can("u-8", "household_invite");
    expect(allowed).toBe(true);
  });

  it("returns false for an unknown userId (resolver synthesizes minimal context, no admin, no cohort)", async () => {
    queue([]); // user lookup → no rows
    queue([]); // override lookup → no rows
    const allowed = await can("u-ghost", "plans_create");
    expect(allowed).toBe(false);
  });
});

describe("can() — launch promo (release v1)", () => {
  it("grants a beta_or_paid feature to a free, non-beta user when launch mode is on", async () => {
    launchFreeAccess.value = true;
    queue([{ id: "u-l1", role: "root_app_user", betaCohort: null }]);
    queue([]); // override lookup → no rows
    const allowed = await can("u-l1", "ai_share_recipe");
    expect(allowed).toBe(true);
  });

  it("denies the same user when launch mode is off (sanity that the flag is what flips it)", async () => {
    launchFreeAccess.value = false;
    queue([{ id: "u-l2", role: "root_app_user", betaCohort: null }]);
    queue([]);
    const allowed = await can("u-l2", "ai_share_recipe");
    expect(allowed).toBe(false);
  });

  it("an explicit per-user paid_only override still wins over launch mode", async () => {
    // Launch mode would otherwise grant access; the user-targeted
    // override pins them to paid_only and they have no subscription, so
    // they're denied. Confirms the promo only affects the default-rule
    // step, never override rows.
    launchFreeAccess.value = true;
    queue([{ id: "u-l3", role: "root_app_user", betaCohort: null }]);
    queue([{ userId: "u-l3", cohort: null, ruleOverride: "paid_only" }]);
    const allowed = await can("u-l3", "ai_share_recipe");
    expect(allowed).toBe(false);
  });
});

describe("can() — memoization", () => {
  it("loads user context once per process under react.cache (multiple calls with same userId)", async () => {
    // Vitest runs tests outside a React render context, so React.cache
    // behaves as a per-invocation cache rather than per-request. The
    // first call drains user-lookup + override-lookup; the second call
    // for the SAME userId in the SAME test process should ALSO hit the
    // user-lookup again because react.cache scopes to "current cache
    // signal" which is undefined outside a request. We pin that
    // behavior — the test documents what to expect rather than
    // pretending memoization works in this harness.
    queue([{ id: "u-9", role: "platform_admin", betaCohort: null }]);
    const first = await can("u-9", "ai_share_recipe");
    expect(first).toBe(true);

    // Second call: queue another user lookup since cache doesn't kick
    // in here. In a real Next request the cache would dedupe.
    queue([{ id: "u-9", role: "platform_admin", betaCohort: null }]);
    const second = await can("u-9", "ai_share_recipe");
    expect(second).toBe(true);
  });
});
