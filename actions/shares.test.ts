import { beforeEach, describe, expect, it, vi } from "vitest";

// Short-circuit the env-validation chain (actions/shares.ts → lib/auth →
// lib/db/client). Same pattern as actions/account.test.ts.
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: async () => ({
    id: "u-1",
    name: "Alex",
    email: "alex@example.com",
    image: null,
    role: "root_app_user" as const
  })
}));

const rateLimitMock = vi.hoisted(() => ({
  checkShareCreationLimit: vi.fn<(userId: string) => Promise<void>>()
}));
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);

const serviceMock = vi.hoisted(() => ({
  createRecipeShare: vi.fn(),
  revokeRecipeShare: vi.fn(),
  listSharesForMeal: vi.fn()
}));
vi.mock("@/services/shares", () => serviceMock);

import {
  createRecipeShareAction,
  getShareForMealAction,
  revokeRecipeShareAction
} from "./shares";
import { FeatureGateDeniedError } from "@/lib/errors/gates";

beforeEach(() => {
  rateLimitMock.checkShareCreationLimit.mockReset();
  rateLimitMock.checkShareCreationLimit.mockResolvedValue();
  serviceMock.createRecipeShare.mockReset();
  serviceMock.revokeRecipeShare.mockReset();
  serviceMock.listSharesForMeal.mockReset();
});

const VALID_MEAL_ID = "0e2a8d4f-2a2f-4b6a-9c70-7d3a5b1a2c45";

describe("createRecipeShareAction discriminated-union surface", () => {
  it("returns VALIDATION when mealId isn't a uuid", async () => {
    const result = await createRecipeShareAction({ mealId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION");
    expect(serviceMock.createRecipeShare).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the share-creation budget is exhausted", async () => {
    rateLimitMock.checkShareCreationLimit.mockRejectedValueOnce(new Error("rate"));
    const result = await createRecipeShareAction({ mealId: VALID_MEAL_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATE_LIMITED");
    expect(serviceMock.createRecipeShare).not.toHaveBeenCalled();
  });

  it("returns UPGRADE_REQUIRED with the feature key when the gate denies", async () => {
    serviceMock.createRecipeShare.mockRejectedValueOnce(
      new FeatureGateDeniedError("recipe_share_create")
    );
    const result = await createRecipeShareAction({ mealId: VALID_MEAL_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UPGRADE_REQUIRED");
      expect(result.feature).toBe("recipe_share_create");
    }
  });

  it("returns ARCHIVED when the meal is soft-deleted", async () => {
    serviceMock.createRecipeShare.mockRejectedValueOnce(
      new Error("Meal is archived.")
    );
    const result = await createRecipeShareAction({ mealId: VALID_MEAL_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ARCHIVED");
  });

  it("returns ok with the share URL on success", async () => {
    serviceMock.createRecipeShare.mockResolvedValueOnce({
      shareId: "s-1",
      token: "t",
      url: "https://test.eeatly.app/share/t"
    });
    const result = await createRecipeShareAction({ mealId: VALID_MEAL_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shareId).toBe("s-1");
      expect(result.url).toBe("https://test.eeatly.app/share/t");
    }
  });
});

describe("revokeRecipeShareAction", () => {
  it("returns NOT_FOUND for an unknown share id", async () => {
    serviceMock.revokeRecipeShare.mockRejectedValueOnce(
      new Error("Share not found.")
    );
    const result = await revokeRecipeShareAction({ shareId: VALID_MEAL_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns ok on successful revoke", async () => {
    serviceMock.revokeRecipeShare.mockResolvedValueOnce(undefined);
    const result = await revokeRecipeShareAction({ shareId: VALID_MEAL_ID });
    expect(result.ok).toBe(true);
  });
});

describe("getShareForMealAction", () => {
  it("returns null share when the meal has no active shares", async () => {
    serviceMock.listSharesForMeal.mockResolvedValueOnce([]);
    const result = await getShareForMealAction({ mealId: VALID_MEAL_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.share).toBeNull();
  });

  it("returns the first active share when one exists", async () => {
    serviceMock.listSharesForMeal.mockResolvedValueOnce([
      { id: "s-1", url: "https://test.eeatly.app/share/t" }
    ]);
    const result = await getShareForMealAction({ mealId: VALID_MEAL_ID });
    expect(result.ok).toBe(true);
    if (result.ok && result.share) {
      expect(result.share.shareId).toBe("s-1");
      expect(result.share.url).toBe("https://test.eeatly.app/share/t");
    }
  });
});
