import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same Proxy db mock pattern as the other service tests.
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

vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APP_URL: "https://test.eeatly.app"
  })
}));

const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));
vi.mock("@/lib/auth/session", () => sessionMock);

const gateMock = vi.hoisted(() => ({
  requireFeatureAccess: vi.fn<(userId: string, feature: string) => Promise<void>>(),
  can: vi.fn<(userId: string, feature: string) => Promise<boolean>>()
}));
vi.mock("@/lib/gates/resolver", () => gateMock);

import {
  createRecipeShare,
  getRecipeShareByToken,
  listSharesForMeal,
  revokeRecipeShare
} from "./shares";
import { FeatureGateDeniedError } from "@/lib/errors/gates";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  gateMock.requireFeatureAccess.mockReset();
  gateMock.requireFeatureAccess.mockResolvedValue();
  gateMock.can.mockReset();
  gateMock.can.mockResolvedValue(true);
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("createRecipeShare", () => {
  // R32 — meal lookups now project `createdByUserId` so the
  // creator-only check can run. Tests where the operation should
  // succeed pin the creator to match the caller.
  it("rejects when the meal isn't in the caller's household", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-other",
        archivedAt: null,
        createdByUserId: "u-other"
      }
    ]);
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      createRecipeShare({ userId: "u-stranger", mealId: "m-1" })
    ).rejects.toThrow(/Not authorized/);

    // afterEach guards that no further queries fired.
  });

  it("rejects when the feature gate denies (non-beta non-paid)", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        archivedAt: null,
        // Pin creator to caller so the test reaches the gate check.
        createdByUserId: "u-free"
      }
    ]);
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new FeatureGateDeniedError("recipe_share_create")
    );

    await expect(
      createRecipeShare({ userId: "u-free", mealId: "m-1" })
    ).rejects.toBeInstanceOf(FeatureGateDeniedError);
  });

  it("rejects archived meals", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        archivedAt: new Date("2025-01-01"),
        createdByUserId: "u-a"
      }
    ]);

    await expect(
      createRecipeShare({ userId: "u-a", mealId: "m-1" })
    ).rejects.toThrow(/archived/);
  });

  it("R32 — rejects when the caller isn't the meal's creator", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        archivedAt: null,
        createdByUserId: "u-creator"
      }
    ]);

    await expect(
      createRecipeShare({ userId: "u-other-member", mealId: "m-1" })
    ).rejects.toThrow(/creator/);
  });

  it("returns the existing share when one is already active for this meal (idempotent)", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        archivedAt: null,
        createdByUserId: "u-a"
      }
    ]); // meal lookup
    queue([
      { id: "s-existing", token: "existing-token-1234567890123456789012345678901" }
    ]); // existing-share lookup

    const result = await createRecipeShare({ userId: "u-a", mealId: "m-1" });

    expect(result.shareId).toBe("s-existing");
    expect(result.token).toBe("existing-token-1234567890123456789012345678901");
    expect(result.url).toBe(
      "https://test.eeatly.app/share/existing-token-1234567890123456789012345678901"
    );
    // No insert queued — the idempotent path skipped it.
  });

  it("inserts a new share when no active share exists", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        archivedAt: null,
        createdByUserId: "u-a"
      }
    ]); // meal lookup
    queue([]); // existing-share lookup returns nothing
    queue([{ id: "s-new" }]); // insert .returning()

    const result = await createRecipeShare({ userId: "u-a", mealId: "m-1" });

    expect(result.shareId).toBe("s-new");
    // Token is randomly generated — pin its shape instead of the value.
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(result.url).toBe(`https://test.eeatly.app/share/${result.token}`);
  });
});

describe("getRecipeShareByToken", () => {
  it("returns null for an unknown token (404 path)", async () => {
    queue([]);
    const result = await getRecipeShareByToken({ token: "anything" });
    expect(result).toBeNull();
  });

  it("returns null for a revoked share", async () => {
    queue([
      {
        shareId: "s-1",
        revokedAt: new Date("2026-05-01"),
        createdAt: new Date("2026-04-01"),
        mealName: "Pasta",
        recipeText: "...",
        recipeSourceUrl: null,
        photoUrl: null,
        archivedAt: null,
        householdName: "Test Kitchen"
      }
    ]);
    const result = await getRecipeShareByToken({ token: "revoked-token" });
    expect(result).toBeNull();
  });

  it("returns null when the underlying meal is archived (soft 404)", async () => {
    queue([
      {
        shareId: "s-1",
        revokedAt: null,
        createdAt: new Date("2026-04-01"),
        mealName: "Pasta",
        recipeText: "...",
        recipeSourceUrl: null,
        photoUrl: null,
        archivedAt: new Date("2026-04-15"),
        householdName: "Test Kitchen"
      }
    ]);
    expect(await getRecipeShareByToken({ token: "x" })).toBeNull();
  });

  it("performs NO auth check — knowing the token is the only access (mock would have fired)", async () => {
    queue([
      {
        shareId: "s-1",
        revokedAt: null,
        createdAt: new Date("2026-04-01"),
        mealName: "Pasta",
        recipeText: "ingredients\nsteps",
        recipeSourceUrl: null,
        photoUrl: null,
        archivedAt: null,
        householdName: "Test Kitchen"
      }
    ]);

    const result = await getRecipeShareByToken({ token: "x" });
    expect(result?.mealName).toBe("Pasta");
    // requireHouseholdMember and requireFeatureAccess must NOT have been
    // called. Public reads are intentionally open.
    expect(sessionMock.requireHouseholdMember).not.toHaveBeenCalled();
    expect(gateMock.requireFeatureAccess).not.toHaveBeenCalled();
  });
});

describe("revokeRecipeShare", () => {
  // R32 — revoke lookup now joins meals, so the projected row carries
  // `createdByUserId`. Tests pin it to the caller for paths that
  // should succeed.
  it("rejects when the caller isn't in the share's household", async () => {
    queue([
      {
        id: "s-1",
        householdId: "h-other",
        revokedAt: null,
        createdByUserId: "u-other-creator"
      }
    ]);
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      revokeRecipeShare({ userId: "u-stranger", shareId: "s-1" })
    ).rejects.toThrow(/Not authorized/);
  });

  it("R32 — rejects when the caller isn't the share's creator", async () => {
    queue([
      {
        id: "s-1",
        householdId: "h-a",
        revokedAt: null,
        createdByUserId: "u-creator"
      }
    ]);

    await expect(
      revokeRecipeShare({ userId: "u-other-member", shareId: "s-1" })
    ).rejects.toThrow(/creator/);
  });

  it("soft no-ops when the share is already revoked (double-click safe)", async () => {
    queue([
      {
        id: "s-1",
        householdId: "h-a",
        revokedAt: new Date("2026-05-01"),
        createdByUserId: "u-a"
      }
    ]);
    await revokeRecipeShare({ userId: "u-a", shareId: "s-1" });
    // No update queued — the function returned early.
  });

  it("issues the revoke update when the share is currently active", async () => {
    queue([
      {
        id: "s-1",
        householdId: "h-a",
        revokedAt: null,
        createdByUserId: "u-a"
      }
    ]);
    queue([]); // update returning

    await revokeRecipeShare({ userId: "u-a", shareId: "s-1" });
  });
});

describe("listSharesForMeal", () => {
  // R32 — listing now bails to `[]` for non-creators so the dialog
  // stays simple. Tests that exercise the populated branch pin the
  // creator to the caller.
  it("requires household membership before listing", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        createdByUserId: "u-creator",
        sharedAt: null
      }
    ]);
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      listSharesForMeal({ userId: "u-stranger", mealId: "m-1" })
    ).rejects.toThrow(/Not authorized/);
  });

  it("R32 — returns empty list for non-creators (no leak)", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        createdByUserId: "u-creator",
        sharedAt: new Date("2026-04-01")
      }
    ]);

    const rows = await listSharesForMeal({
      userId: "u-other-member",
      mealId: "m-1"
    });
    expect(rows).toEqual([]);
  });

  it("returns active shares with full URL", async () => {
    queue([
      {
        id: "m-1",
        householdId: "h-a",
        createdByUserId: "u-a",
        sharedAt: null
      }
    ]);
    queue([
      {
        id: "s-1",
        mealId: "m-1",
        token: "abcdefghijklmnopqrstuvwxyz1234567890",
        mealName: "Pasta",
        createdAt: new Date("2026-05-01"),
        createdByName: "Alex"
      }
    ]);

    const rows = await listSharesForMeal({ userId: "u-a", mealId: "m-1" });
    expect(rows[0]?.url).toBe(
      "https://test.eeatly.app/share/abcdefghijklmnopqrstuvwxyz1234567890"
    );
  });
});
