import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mocks for the auth + gate + service surface every read router
// touches. Each mock returns a sentinel so we can assert the procedure
// reached the right service with the right args.

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

// Admin router pulls in the drizzle client directly (for the
// dispatchLifecycleEmail user lookup). Stub the client to avoid
// env-validation cascades; tests of that procedure mock the methods
// they need explicitly.
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => []
        })
      })
    })
  }
}));

vi.mock("@/lib/email/transactional", () => ({
  dispatchTransactionalEmail: vi.fn(async () => ({ skipped: false, detail: null })),
  sendAccountDeletedEmail: vi.fn(async () => undefined)
}));

vi.mock("@/services/user-lifecycle", () => ({
  updateUserBetaCohort: vi.fn(async () => undefined)
}));

vi.mock("@/lib/observability/analytics", () => ({
  trackEvent: vi.fn()
}));

// trpc.ts pulls in the gate resolver + rate limiters at module load;
// stubbing them here avoids the env-validation cascade in tests.
vi.mock("@/lib/gates/resolver", () => ({
  requireFeatureAccess: vi.fn(async () => undefined),
  can: vi.fn(async () => true)
}));

const rateLimitMock = vi.hoisted(() => ({
  checkMealMutationLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkAiCallLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkUploadPresignLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkFeedbackLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkInvitationLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkShareCreationLimit: vi.fn<(userId: string) => Promise<void>>()
}));
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);

const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>(),
  requireHouseholdOwner: vi.fn<(userId: string, householdId: string) => Promise<void>>(),
  getCurrentHousehold: vi.fn<(userId: string) => Promise<{ id: string; name: string }>>()
}));
vi.mock("@/lib/auth/session", () => sessionMock);

const mealsServiceMock = vi.hoisted(() => ({
  getDashboardMeals: vi.fn(),
  getHistoryRows: vi.fn(),
  getHistoryStats: vi.fn(),
  getMealDetail: vi.fn(),
  createMealLog: vi.fn(),
  deleteMealLog: vi.fn(),
  setMealPhoto: vi.fn(),
  archiveMeal: vi.fn(),
  unarchiveMeal: vi.fn(),
  deleteMeal: vi.fn(),
  restoreMeal: vi.fn(),
  listArchivedRecipes: vi.fn()
}));
vi.mock("@/services/meals", () => mealsServiceMock);

const recipeEditServiceMock = vi.hoisted(() => ({
  saveStructuredRecipe: vi.fn()
}));
vi.mock("@/services/recipe-edit", () => recipeEditServiceMock);

// AI service mock — the ai router imports these named exports at module
// load, so every one must be present or the router fails to construct.
const aiServiceMock = vi.hoisted(() => ({
  suggestMealFromImage: vi.fn(),
  suggestMealFromText: vi.fn(),
  suggestMealFromAudio: vi.fn(),
  extractIngredientsForMeal: vi.fn(),
  generateShareableRecipe: vi.fn(),
  generateDishImageForMeal: vi.fn(),
  getExistingMealImage: vi.fn()
}));
vi.mock("@/services/ai", () => aiServiceMock);

vi.mock("@/lib/observability/funnel", () => ({
  trackMealLogLifecycleEvent: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const householdsServiceMock = vi.hoisted(() => ({
  listHouseholdMembers: vi.fn(),
  listPendingInvitations: vi.fn(),
  countHouseholdMembers: vi.fn(),
  findInvitationContextByToken: vi.fn()
}));
vi.mock("@/services/households", () => householdsServiceMock);

const plansServiceMock = vi.hoisted(() => ({
  getPlan: vi.fn(),
  listPlansForHousehold: vi.fn(),
  getPlanEffortAggregate: vi.fn(),
  getPlanAnnotationsByMealId: vi.fn(),
  listMealLibrary: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  archivePlan: vi.fn(),
  unarchivePlan: vi.fn(),
  addDishToPlan: vi.fn(),
  removeDishFromPlan: vi.fn(),
  reorderDishes: vi.fn(),
  updateDishAnnotation: vi.fn(),
  clonePlanFromPast: vi.fn()
}));
vi.mock("@/services/plans", () => plansServiceMock);

const sharesServiceMock = vi.hoisted(() => ({
  listSharesForMeal: vi.fn(),
  getRecipeShareByToken: vi.fn(),
  createRecipeShare: vi.fn(),
  revokeRecipeShare: vi.fn()
}));
vi.mock("@/services/shares", () => sharesServiceMock);

const billingServiceMock = vi.hoisted(() => ({
  getSubscriptionState: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  createCreditCheckoutSession: vi.fn()
}));
vi.mock("@/services/billing", () => billingServiceMock);

// withAiCredits is a passthrough in tests — credit metering is unit-tested
// separately in ai-credits.test. The router-level tests only care that the
// wrapped service is invoked.
const aiCreditsMock = vi.hoisted(() => ({
  withAiCredits: vi.fn(<T>(_u: string, _op: string, fn: () => Promise<T>) => fn()),
  getCreditBalance: vi.fn(),
  getUserTier: vi.fn(),
  applyTierGrant: vi.fn(),
  grantPurchasedCredits: vi.fn()
}));
vi.mock("@/services/ai-credits", () => aiCreditsMock);

const notificationsServiceMock = vi.hoisted(() => ({
  listNotificationsForUser: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  createNotification: vi.fn(async () => undefined)
}));
vi.mock("@/services/notifications", () => notificationsServiceMock);

const featureOverridesServiceMock = vi.hoisted(() => ({
  listFeaturesWithCounts: vi.fn(),
  listOverridesForFeature: vi.fn(),
  searchUsersForOverride: vi.fn()
}));
vi.mock("@/services/feature-overrides", () => featureOverridesServiceMock);

// Round 18 — Refine service mock. Each public function returns a
// sentinel so the procedure tests can assert call-shape without
// reaching the real DB / AI provider chain.
const refineServiceMock = vi.hoisted(() => ({
  startSession: vi.fn(),
  getSessionState: vi.fn(),
  submitTextTurn: vi.fn(),
  submitVoiceTurn: vi.fn(),
  submitPhotoTurn: vi.fn(),
  toggleTurnAccepted: vi.fn(),
  saveSession: vi.fn(),
  discardSession: vi.fn()
}));
vi.mock("@/services/refine", () => refineServiceMock);

import { createCallerFactory } from "../trpc";
import { appRouter } from "../app-router";
import type { TRPCContext } from "../context";
import type { AppUser } from "@/lib/auth/session";

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "u-1",
    name: "Alex",
    email: "alex@example.com",
    image: null,
    role: "root_app_user",
    ...overrides
  };
}

function makeCtx(user: AppUser | null): TRPCContext {
  return {
    user,
    headers: new Headers(),
    getCurrentHousehold: async () => ({ id: "h-current", name: "Home Kitchen" })
  };
}

const call = (user: AppUser | null) =>
  createCallerFactory(appRouter)(makeCtx(user));

beforeEach(() => {
  for (const fn of Object.values(sessionMock)) fn.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  sessionMock.requireHouseholdOwner.mockResolvedValue();
  sessionMock.getCurrentHousehold.mockResolvedValue({
    id: "h-current",
    name: "Home Kitchen"
  });
  for (const fn of Object.values(rateLimitMock)) {
    fn.mockReset();
    fn.mockResolvedValue();
  }
  for (const map of [
    mealsServiceMock,
    aiServiceMock,
    householdsServiceMock,
    plansServiceMock,
    sharesServiceMock,
    billingServiceMock,
    notificationsServiceMock,
    featureOverridesServiceMock,
    refineServiceMock
  ]) {
    for (const fn of Object.values(map)) fn.mockReset();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("dashboardRouter.meals", () => {
  it("requires auth", async () => {
    await expect(call(null).dashboard.meals()).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
  });

  it("calls getDashboardMeals with user + household + input", async () => {
    mealsServiceMock.getDashboardMeals.mockResolvedValueOnce({
      recentMeals: [],
      mostCookedMeals: [],
      neglectedMeals: [],
      suggestions: []
    });
    await call(makeUser()).dashboard.meals({ suggestionLimit: 12 });
    expect(mealsServiceMock.getDashboardMeals).toHaveBeenCalledWith(
      "u-1",
      "h-current",
      { suggestionLimit: 12 }
    );
  });
});

describe("mealsRouter", () => {
  it("getById passes through to getMealDetail", async () => {
    mealsServiceMock.getMealDetail.mockResolvedValueOnce(null);
    const result = await call(makeUser()).meals.getById({
      mealId: "11111111-1111-4111-8111-111111111111"
    });
    expect(result).toBeNull();
    expect(mealsServiceMock.getMealDetail).toHaveBeenCalledWith(
      "u-1",
      "h-current",
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("historyRows respects an explicit page/sort/filter input", async () => {
    mealsServiceMock.getHistoryRows.mockResolvedValueOnce({
      rows: [],
      total: 0,
      page: 2,
      pageSize: 25
    });
    await call(makeUser()).meals.historyRows({
      tab: "most",
      sort: "name",
      dir: "asc",
      page: 2,
      pageSize: 25,
      effortLevels: ["easy", "medium"]
    });
    expect(mealsServiceMock.getHistoryRows).toHaveBeenCalledWith(
      "u-1",
      "h-current",
      expect.objectContaining({ tab: "most", page: 2, pageSize: 25 })
    );
  });

  it("historyRows rejects an out-of-range pageSize at the input layer", async () => {
    await expect(
      call(makeUser()).meals.historyRows({ pageSize: 500 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mealsServiceMock.getHistoryRows).not.toHaveBeenCalled();
  });

  it("historyStats calls the service", async () => {
    mealsServiceMock.getHistoryStats.mockResolvedValueOnce({
      thisYear: 4,
      thisMonth: 1,
      neglectedCount: 0,
      counts: { recent: 4, most: 2, neglected: 0 }
    });
    const stats = await call(makeUser()).meals.historyStats();
    expect(stats.thisYear).toBe(4);
    expect(mealsServiceMock.getHistoryStats).toHaveBeenCalledWith("u-1", "h-current");
  });
});

describe("notificationsRouter.list", () => {
  it("calls listNotificationsForUser with options", async () => {
    notificationsServiceMock.listNotificationsForUser.mockResolvedValueOnce({
      rows: [],
      unreadCount: 0
    });
    await call(makeUser()).notifications.list({ onlyUnread: true });
    expect(notificationsServiceMock.listNotificationsForUser).toHaveBeenCalledWith(
      "u-1",
      { onlyUnread: true }
    );
  });
});

describe("householdsRouter", () => {
  it("current parallels the three reads", async () => {
    householdsServiceMock.listHouseholdMembers.mockResolvedValueOnce([
      { userId: "u-1", name: "Alex", email: "a@x", role: "owner", joinedAt: new Date() }
    ]);
    householdsServiceMock.countHouseholdMembers.mockResolvedValueOnce(1);
    const result = await call(makeUser()).households.current();
    expect(result.memberCount).toBe(1);
    expect(result.id).toBe("h-current");
  });

  it("pendingInvitations gates on owner middleware", async () => {
    sessionMock.requireHouseholdOwner.mockRejectedValueOnce(new Error("not owner"));
    await expect(call(makeUser()).households.pendingInvitations()).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
    expect(householdsServiceMock.listPendingInvitations).not.toHaveBeenCalled();
  });

  it("invitationByToken is public — no session required", async () => {
    householdsServiceMock.findInvitationContextByToken.mockResolvedValueOnce(null);
    await call(null).households.invitationByToken({ token: "abcdefghij" });
    expect(householdsServiceMock.findInvitationContextByToken).toHaveBeenCalledWith(
      "abcdefghij"
    );
  });
});

describe("plansRouter", () => {
  it("list calls service with household scope", async () => {
    plansServiceMock.listPlansForHousehold.mockResolvedValueOnce([]);
    await call(makeUser()).plans.list({ includeArchived: true });
    expect(plansServiceMock.listPlansForHousehold).toHaveBeenCalledWith({
      userId: "u-1",
      householdId: "h-current",
      includeArchived: true
    });
  });

  it("getById requires a uuid", async () => {
    await expect(
      call(makeUser()).plans.getById({ planId: "not-a-uuid" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("sharesRouter", () => {
  it("listForMeal scopes to household membership", async () => {
    sharesServiceMock.listSharesForMeal.mockResolvedValueOnce([]);
    await call(makeUser()).shares.listForMeal({
      mealId: "11111111-1111-4111-8111-111111111111"
    });
    expect(sharesServiceMock.listSharesForMeal).toHaveBeenCalled();
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalled();
  });

  it("getByToken is public", async () => {
    sharesServiceMock.getRecipeShareByToken.mockResolvedValueOnce(null);
    await call(null).shares.getByToken({ token: "publictoken123" });
    expect(sharesServiceMock.getRecipeShareByToken).toHaveBeenCalledWith({
      token: "publictoken123"
    });
  });
});

describe("billingRouter.currentSubscription", () => {
  it("requires auth and passes userId", async () => {
    await expect(call(null).billing.currentSubscription()).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
    billingServiceMock.getSubscriptionState.mockResolvedValueOnce(null);
    await call(makeUser()).billing.currentSubscription();
    expect(billingServiceMock.getSubscriptionState).toHaveBeenCalledWith({
      userId: "u-1"
    });
  });
});

describe("searchRouter.meals", () => {
  it("rejects empty q", async () => {
    await expect(
      call(makeUser()).search.meals({ q: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("passes q + limit through to listMealLibrary", async () => {
    plansServiceMock.listMealLibrary.mockResolvedValueOnce([]);
    await call(makeUser()).search.meals({ q: "rice", limit: 10 });
    expect(plansServiceMock.listMealLibrary).toHaveBeenCalledWith({
      userId: "u-1",
      householdId: "h-current",
      q: "rice",
      limit: 10
    });
  });
});

describe("mealsRouter mutations (Task 3)", () => {
  it("createLog: rate-limits before touching the service", async () => {
    rateLimitMock.checkMealMutationLimit.mockRejectedValueOnce(
      new Error("Too many requests.")
    );
    await expect(
      call(makeUser()).meals.createLog({
        log: {
          mealName: "Soy ginger noodles",
          effortLevel: "easy",
          notes: "",
          cookedDate: "2026-05-13",
          photoUrl: "",
          recipeText: "",
          recipeSourceUrl: ""
        }
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mealsServiceMock.createMealLog).not.toHaveBeenCalled();
  });

  it("createLog: passes input through and returns the new log id + meal id", async () => {
    mealsServiceMock.createMealLog.mockResolvedValueOnce({
      mealLog: { id: "log-1", mealId: "meal-1" },
      mealLogCount: 1
    });
    const result = await call(makeUser()).meals.createLog({
      log: {
        mealName: "Biryani",
        effortLevel: "medium",
        notes: "",
        cookedDate: "2026-05-14",
        photoUrl: "",
        recipeText: "",
        recipeSourceUrl: ""
      },
      source: "quick_log"
    });
    expect(result.mealLog.id).toBe("log-1");
    expect(result.mealId).toBe("meal-1");
    expect(mealsServiceMock.createMealLog).toHaveBeenCalledWith(
      "u-1",
      "h-current",
      expect.objectContaining({ mealName: "Biryani" })
    );
  });

  it("deleteLog: maps service 'not found' to NOT_FOUND with cause", async () => {
    mealsServiceMock.deleteMealLog.mockRejectedValueOnce(
      new Error("Meal log not found.")
    );
    let caught: unknown;
    try {
      await call(makeUser()).meals.deleteLog({
        logId: "11111111-1111-4111-8111-111111111111"
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "NOT_FOUND" });
  });

  // R36 — per-recipe management.
  const mealId = "33333333-3333-4333-8333-333333333333";

  it("archive: passes the meal id through to the owner-scoped service", async () => {
    mealsServiceMock.archiveMeal.mockResolvedValueOnce(undefined);
    const result = await call(makeUser()).meals.archive({ mealId });
    expect(result).toEqual({ ok: true });
    expect(mealsServiceMock.archiveMeal).toHaveBeenCalledWith("u-1", "h-current", mealId);
  });

  it("delete: rate-limits before touching the service", async () => {
    rateLimitMock.checkMealMutationLimit.mockRejectedValueOnce(new Error("Too many requests."));
    await expect(call(makeUser()).meals.delete({ mealId })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS"
    });
    expect(mealsServiceMock.deleteMeal).not.toHaveBeenCalled();
  });

  it("restore: maps service 'not found' to NOT_FOUND with a MEAL_NOT_FOUND cause", async () => {
    mealsServiceMock.restoreMeal.mockRejectedValueOnce(new Error("Recipe not found."));
    let caught: unknown;
    try {
      await call(makeUser()).meals.restore({ mealId });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "NOT_FOUND" });
  });

  it("archivedList: returns the service rows", async () => {
    mealsServiceMock.listArchivedRecipes.mockResolvedValueOnce([
      { id: mealId, name: "Old soup", photoUrl: null, createdByUserId: "u-1", cookCount: 2, lastCookedAt: null, archivedAt: null }
    ]);
    const result = await call(makeUser()).meals.archivedList();
    expect(result).toHaveLength(1);
    expect(mealsServiceMock.listArchivedRecipes).toHaveBeenCalledWith("u-1", "h-current");
  });

  it("setPhoto: passes input through and returns the saved photo URL", async () => {
    mealsServiceMock.setMealPhoto.mockResolvedValueOnce({
      photoUrl: "https://r2.example/users/u-1/meal-photos/x.jpg"
    });
    const result = await call(makeUser()).meals.setPhoto({
      mealId: "22222222-2222-4222-8222-222222222222",
      photoUrl: "https://r2.example/users/u-1/meal-photos/x.jpg"
    });
    expect(result.photoUrl).toBe(
      "https://r2.example/users/u-1/meal-photos/x.jpg"
    );
    expect(mealsServiceMock.setMealPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        householdId: "h-current",
        mealId: "22222222-2222-4222-8222-222222222222"
      })
    );
  });

  it("setPhoto: maps a non-creator service error to FORBIDDEN", async () => {
    mealsServiceMock.setMealPhoto.mockRejectedValueOnce(
      new Error("Only the creator can change this meal's photo.")
    );
    let caught: unknown;
    try {
      await call(makeUser()).meals.setPhoto({
        mealId: "22222222-2222-4222-8222-222222222222",
        photoUrl: "https://r2.example/users/u-9/meal-photos/y.jpg"
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({
      code: "FORBIDDEN",
      cause: { reason: "NOT_CREATOR" }
    });
  });

  it("saveStructuredRecipe: passes ingredients + steps through (no credits)", async () => {
    recipeEditServiceMock.saveStructuredRecipe.mockResolvedValueOnce({
      ingredientCount: 2,
      stepCount: 1
    });
    const result = await call(makeUser()).meals.saveStructuredRecipe({
      mealId: "22222222-2222-4222-8222-222222222222",
      ingredients: [
        { name: "Rice", quantityString: "1 cup" },
        { name: "Salt", quantityString: "" }
      ],
      steps: [{ title: "Cook", time: "10 min", body: "Boil the rice." }]
    });
    expect(result).toEqual({ ingredientCount: 2, stepCount: 1 });
    expect(recipeEditServiceMock.saveStructuredRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        mealId: "22222222-2222-4222-8222-222222222222"
      })
    );
  });

  it("saveStructuredRecipe: maps a not-authorized service error to FORBIDDEN", async () => {
    recipeEditServiceMock.saveStructuredRecipe.mockRejectedValueOnce(
      new Error("Not authorized to edit this item.")
    );
    let caught: unknown;
    try {
      await call(makeUser()).meals.saveStructuredRecipe({
        mealId: "22222222-2222-4222-8222-222222222222",
        ingredients: [],
        steps: []
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({
      code: "FORBIDDEN",
      cause: { reason: "NOT_AUTHORIZED" }
    });
  });
});

describe("aiRouter.generateDishImage", () => {
  it("requires auth", async () => {
    await expect(
      call(null).ai.generateDishImage({
        mealId: "33333333-3333-4333-8333-333333333333"
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("generates + charges (charged: true) when no image exists yet", async () => {
    aiServiceMock.getExistingMealImage.mockResolvedValueOnce({ imageUrl: null });
    aiServiceMock.generateDishImageForMeal.mockResolvedValueOnce({
      imageUrl: "https://r2.example/dish-images/abc.png"
    });
    const result = await call(makeUser()).ai.generateDishImage({
      mealId: "33333333-3333-4333-8333-333333333333"
    });
    expect(result).toEqual({
      imageUrl: "https://r2.example/dish-images/abc.png",
      charged: true
    });
    expect(aiCreditsMock.withAiCredits).toHaveBeenCalledWith(
      "u-1",
      "dish_image",
      expect.any(Function)
    );
    expect(aiServiceMock.generateDishImageForMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        householdId: "h-current",
        mealId: "33333333-3333-4333-8333-333333333333"
      })
    );
  });

  it("returns an existing image for free (charged: false), no generation", async () => {
    aiServiceMock.getExistingMealImage.mockResolvedValueOnce({
      imageUrl: "https://r2.example/existing.png"
    });
    const result = await call(makeUser()).ai.generateDishImage({
      mealId: "33333333-3333-4333-8333-333333333333"
    });
    expect(result).toEqual({
      imageUrl: "https://r2.example/existing.png",
      charged: false
    });
    expect(aiServiceMock.generateDishImageForMeal).not.toHaveBeenCalled();
    expect(aiCreditsMock.withAiCredits).not.toHaveBeenCalled();
  });

  it("degrades to { imageUrl: null, charged: false } when generation fails", async () => {
    aiServiceMock.getExistingMealImage.mockResolvedValueOnce({ imageUrl: null });
    aiServiceMock.generateDishImageForMeal.mockRejectedValueOnce(
      new Error("provider down")
    );
    const result = await call(makeUser()).ai.generateDishImage({
      mealId: "33333333-3333-4333-8333-333333333333"
    });
    expect(result).toEqual({ imageUrl: null, charged: false });
  });
});

describe("plansRouter mutations (Task 3)", () => {
  it("create: rate-limits + passes input + returns the new plan id", async () => {
    plansServiceMock.createPlan.mockResolvedValueOnce({ id: "p-1" });
    const result = await call(makeUser()).plans.create({
      name: "Eid 2026",
      scheduledDate: "2026-04-10",
      notes: ""
    });
    expect(result.planId).toBe("p-1");
  });

  it("create: maps FeatureGateDeniedError to FORBIDDEN with UPGRADE_REQUIRED cause", async () => {
    const { FeatureGateDeniedError } = await import("@/lib/errors/gates");
    plansServiceMock.createPlan.mockRejectedValueOnce(
      new FeatureGateDeniedError("plans_create")
    );
    let caught: unknown;
    try {
      await call(makeUser()).plans.create({
        name: "Eid 2026",
        scheduledDate: "2026-04-10",
        notes: ""
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "FORBIDDEN" });
    expect((caught as { cause: { reason: string; feature: string } }).cause).toMatchObject({
      reason: "UPGRADE_REQUIRED",
      feature: "plans_create"
    });
  });

  it("addDish: cross-household service error → NOT_FOUND with cause", async () => {
    plansServiceMock.addDishToPlan.mockRejectedValueOnce(
      new Error("Meal is not in this household.")
    );
    let caught: unknown;
    try {
      await call(makeUser()).plans.addDish({
        planId: "22222222-2222-4222-8222-222222222222",
        dish: { mealId: "33333333-3333-4333-8333-333333333333" }
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "NOT_FOUND" });
    expect((caught as { cause: { reason: string } }).cause).toMatchObject({
      reason: "CROSS_HOUSEHOLD"
    });
  });

  it("reorderDishes: rejects non-uuid planId at the input layer", async () => {
    await expect(
      call(makeUser()).plans.reorderDishes({
        planId: "not-a-uuid",
        order: { dishIdsInOrder: [] }
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("sharesRouter mutations (Task 3)", () => {
  it("create: idempotently returns the share id", async () => {
    sharesServiceMock.createRecipeShare.mockResolvedValueOnce({
      shareId: "s-1",
      url: "https://eeatly.app/share/tok",
      created: false
    });
    const result = await call(makeUser()).shares.create({
      mealId: "44444444-4444-4444-8444-444444444444"
    });
    expect(result.shareId).toBe("s-1");
  });

  it("create: rate-limited maps to TOO_MANY_REQUESTS", async () => {
    rateLimitMock.checkShareCreationLimit.mockRejectedValueOnce(
      new Error("daily share limit reached")
    );
    await expect(
      call(makeUser()).shares.create({
        mealId: "44444444-4444-4444-8444-444444444444"
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(sharesServiceMock.createRecipeShare).not.toHaveBeenCalled();
  });

  it("revoke: maps service 'not found' to NOT_FOUND", async () => {
    sharesServiceMock.revokeRecipeShare.mockRejectedValueOnce(
      new Error("Share not found.")
    );
    await expect(
      call(makeUser()).shares.revoke({
        shareId: "55555555-5555-4555-8555-555555555555"
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("activeForMeal: returns the head row when present", async () => {
    sharesServiceMock.listSharesForMeal.mockResolvedValueOnce([
      { id: "s-9", url: "https://eeatly.app/share/x", mealName: "x" }
    ]);
    const result = await call(makeUser()).shares.activeForMeal({
      mealId: "66666666-6666-4666-8666-666666666666"
    });
    expect(result).toEqual({ shareId: "s-9", url: "https://eeatly.app/share/x" });
  });

  it("activeForMeal: returns null when no shares exist", async () => {
    sharesServiceMock.listSharesForMeal.mockResolvedValueOnce([]);
    const result = await call(makeUser()).shares.activeForMeal({
      mealId: "66666666-6666-4666-8666-666666666666"
    });
    expect(result).toBeNull();
  });
});

describe("notificationsRouter mutations (Task 3)", () => {
  it("markRead: calls the service with userId + notificationId", async () => {
    notificationsServiceMock.markNotificationRead.mockResolvedValueOnce(undefined);
    await call(makeUser()).notifications.markRead({
      notificationId: "77777777-7777-4777-8777-777777777777"
    });
    expect(notificationsServiceMock.markNotificationRead).toHaveBeenCalledWith(
      "u-1",
      "77777777-7777-4777-8777-777777777777"
    );
  });

  it("markAllRead: returns the count from the service", async () => {
    notificationsServiceMock.markAllNotificationsRead.mockResolvedValueOnce(4);
    const result = await call(makeUser()).notifications.markAllRead();
    expect(result.updated).toBe(4);
  });
});

describe("adminRouter", () => {
  it("featureRegistry rejects non-admin callers", async () => {
    await expect(call(makeUser()).admin.featureRegistry()).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });

  it("featureRegistry returns the static catalog for admins", async () => {
    const result = await call(makeUser({ role: "platform_admin" })).admin.featureRegistry();
    expect(result.keys.length).toBeGreaterThan(0);
    expect(result.entries).toBeDefined();
  });

  it("overridesForFeature rejects unknown feature keys", async () => {
    await expect(
      call(makeUser({ role: "platform_admin" })).admin.overridesForFeature({
        feature: "not_a_feature"
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("refineRouter (Round 18)", () => {
  const sentinelState = {
    sessionId: "s-1",
    mealId: "m-1",
    startedAt: new Date(),
    turns: [],
    pendingChanges: [],
    summary: { additions: 0, changes: 0, removals: 0 },
    headsUp: []
  };

  it("startSession rejects unauthenticated callers", async () => {
    await expect(
      call(null).refine.startSession({
        mealId: "11111111-1111-4111-8111-111111111111",
        deviceId: "dev-1"
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("startSession passes user + meal + device through to the service", async () => {
    refineServiceMock.startSession.mockResolvedValueOnce(sentinelState);
    const result = await call(makeUser()).refine.startSession({
      mealId: "11111111-1111-4111-8111-111111111111",
      deviceId: "dev-1"
    });
    expect(result).toEqual(sentinelState);
    expect(refineServiceMock.startSession).toHaveBeenCalledWith({
      userId: "u-1",
      mealId: "11111111-1111-4111-8111-111111111111",
      deviceId: "dev-1"
    });
  });

  it("submitTextTurn forwards prompt + checks AI rate limit", async () => {
    refineServiceMock.submitTextTurn.mockResolvedValueOnce(sentinelState);
    await call(makeUser()).refine.submitTextTurn({
      sessionId: "22222222-2222-4222-8222-222222222222",
      prompt: "Bump chicken to 600 g"
    });
    expect(rateLimitMock.checkAiCallLimit).toHaveBeenCalledWith("u-1");
    expect(refineServiceMock.submitTextTurn).toHaveBeenCalledWith({
      userId: "u-1",
      sessionId: "22222222-2222-4222-8222-222222222222",
      prompt: "Bump chicken to 600 g"
    });
  });

  it("submitVoiceTurn decodes the base64 audio buffer", async () => {
    refineServiceMock.submitVoiceTurn.mockResolvedValueOnce({
      ...sentinelState,
      transcript: "test"
    });
    const payload = Buffer.from("hello").toString("base64");
    await call(makeUser()).refine.submitVoiceTurn({
      sessionId: "22222222-2222-4222-8222-222222222222",
      audioBase64: payload,
      mediaType: "audio/m4a"
    });
    const call0 = refineServiceMock.submitVoiceTurn.mock.calls[0]?.[0] as {
      audioBuffer: Buffer;
    };
    expect(call0.audioBuffer).toBeInstanceOf(Buffer);
    expect(call0.audioBuffer.toString()).toBe("hello");
  });

  it("submitPhotoTurn forwards base64 + media type", async () => {
    refineServiceMock.submitPhotoTurn.mockResolvedValueOnce(sentinelState);
    await call(makeUser()).refine.submitPhotoTurn({
      sessionId: "22222222-2222-4222-8222-222222222222",
      imageBase64: "iVBORw",
      mediaType: "image/png"
    });
    expect(refineServiceMock.submitPhotoTurn).toHaveBeenCalledWith({
      userId: "u-1",
      sessionId: "22222222-2222-4222-8222-222222222222",
      imageBase64: "iVBORw",
      mediaType: "image/png"
    });
  });

  it("toggleTurnAccepted threads accepted flag through", async () => {
    refineServiceMock.toggleTurnAccepted.mockResolvedValueOnce(sentinelState);
    await call(makeUser()).refine.toggleTurnAccepted({
      sessionId: "22222222-2222-4222-8222-222222222222",
      turnId: "33333333-3333-4333-8333-333333333333",
      accepted: false
    });
    expect(refineServiceMock.toggleTurnAccepted).toHaveBeenCalledWith({
      userId: "u-1",
      sessionId: "22222222-2222-4222-8222-222222222222",
      turnId: "33333333-3333-4333-8333-333333333333",
      accepted: false
    });
  });

  it("save calls saveSession + checks mutation rate limit", async () => {
    refineServiceMock.saveSession.mockResolvedValueOnce({
      mealId: "m-1",
      applied: 3
    });
    const result = await call(makeUser()).refine.save({
      sessionId: "22222222-2222-4222-8222-222222222222"
    });
    expect(result).toEqual({ mealId: "m-1", applied: 3 });
    expect(rateLimitMock.checkMealMutationLimit).toHaveBeenCalledWith("u-1");
  });

  it("discard calls discardSession", async () => {
    refineServiceMock.discardSession.mockResolvedValueOnce({ discarded: true });
    const result = await call(makeUser()).refine.discard({
      sessionId: "22222222-2222-4222-8222-222222222222"
    });
    expect(result).toEqual({ discarded: true });
  });

  it("maps 'Refine session not found.' to a NOT_FOUND error", async () => {
    refineServiceMock.getSessionState.mockRejectedValueOnce(
      new Error("Refine session not found.")
    );
    await expect(
      call(makeUser()).refine.getPendingChanges({
        sessionId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps 'Refine session is closed.' to a CONFLICT error", async () => {
    refineServiceMock.submitTextTurn.mockRejectedValueOnce(
      new Error("Refine session is closed.")
    );
    await expect(
      call(makeUser()).refine.submitTextTurn({
        sessionId: "22222222-2222-4222-8222-222222222222",
        prompt: "any"
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
