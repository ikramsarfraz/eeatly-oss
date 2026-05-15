import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Short-circuit Better Auth env validation. The trpc module pulls in
// lib/auth/session via gatedProcedure -> requireFeatureAccess -> resolver,
// which transitively imports `auth`. Stubbing here keeps the test pure.
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

// requireHouseholdMember / requireHouseholdOwner are the seams the
// household middleware composes on. Stub them so we don't reach the
// DB; the production behaviour (logs + throws) is already covered in
// lib/auth/session's tests.
const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>(),
  requireHouseholdOwner: vi.fn<(userId: string, householdId: string) => Promise<void>>(),
  getCurrentHousehold: vi.fn<(userId: string) => Promise<{ id: string; name: string }>>()
}));
vi.mock("@/lib/auth/session", () => sessionMock);

const gateMock = vi.hoisted(() => ({
  requireFeatureAccess: vi.fn<(userId: string, feature: string) => Promise<void>>(),
  can: vi.fn<(userId: string, feature: string) => Promise<boolean>>()
}));
vi.mock("@/lib/gates/resolver", () => gateMock);

const rateLimitMock = vi.hoisted(() => ({
  checkAiCallLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkMealMutationLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkUploadPresignLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkFeedbackLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkInvitationLimit: vi.fn<(userId: string) => Promise<void>>(),
  checkShareCreationLimit: vi.fn<(userId: string) => Promise<void>>()
}));
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);

import {
  createCallerFactory,
  gatedProcedure,
  householdMemberProcedure,
  householdOwnerProcedure,
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router
} from "./trpc";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import type { TRPCContext } from "./context";
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

beforeEach(() => {
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  sessionMock.requireHouseholdOwner.mockReset();
  sessionMock.requireHouseholdOwner.mockResolvedValue();
  sessionMock.getCurrentHousehold.mockReset();
  sessionMock.getCurrentHousehold.mockResolvedValue({ id: "h-current", name: "Home Kitchen" });
  gateMock.requireFeatureAccess.mockReset();
  gateMock.requireFeatureAccess.mockResolvedValue();
  for (const fn of Object.values(rateLimitMock)) fn.mockReset();
  for (const fn of Object.values(rateLimitMock)) fn.mockResolvedValue();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("publicProcedure", () => {
  it("runs without a session", async () => {
    const r = router({ ping: publicProcedure.query(() => "pong") });
    const caller = createCallerFactory(r)(makeCtx(null));
    await expect(caller.ping()).resolves.toBe("pong");
  });
});

describe("protectedProcedure", () => {
  it("throws UNAUTHORIZED when no session is attached", async () => {
    const r = router({ me: protectedProcedure.query(({ ctx }) => ctx.user.id) });
    const caller = createCallerFactory(r)(makeCtx(null));
    await expect(caller.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("attaches a non-null user to ctx when authenticated", async () => {
    const r = router({ me: protectedProcedure.query(({ ctx }) => ctx.user.id) });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.me()).resolves.toBe("u-1");
  });
});

describe("householdMemberProcedure", () => {
  it("uses the user's current household when input has no householdId", async () => {
    const r = router({
      hidden: householdMemberProcedure.query(({ ctx }) => ctx.household.id)
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.hidden()).resolves.toBe("h-current");
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-1", "h-current");
  });

  it("uses the explicit householdId from input when present", async () => {
    const r = router({
      forHousehold: householdMemberProcedure
        .input(z.object({ householdId: z.string() }))
        .query(({ ctx }) => ctx.household.id)
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.forHousehold({ householdId: "h-other" })).resolves.toBe(
      "h-other"
    );
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-1", "h-other");
  });

  it("maps requireHouseholdMember rejection to NOT_FOUND (no 403/404 leak)", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );
    const r = router({
      sneak: householdMemberProcedure
        .input(z.object({ householdId: z.string() }))
        .query(() => "shouldn't reach")
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.sneak({ householdId: "h-stranger" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
  });
});

describe("householdOwnerProcedure", () => {
  it("rejects non-owners with FORBIDDEN", async () => {
    sessionMock.requireHouseholdOwner.mockRejectedValueOnce(new Error("not owner"));
    const r = router({ ownerOnly: householdOwnerProcedure.query(() => "ok") });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.ownerOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("succeeds for owners", async () => {
    const r = router({ ownerOnly: householdOwnerProcedure.query(() => "ok") });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.ownerOnly()).resolves.toBe("ok");
  });
});

describe("gatedProcedure", () => {
  it("FORBIDDEN with cause.reason=UPGRADE_REQUIRED on FeatureGateDeniedError", async () => {
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new FeatureGateDeniedError("ai_suggest_image")
    );
    const r = router({
      photo: gatedProcedure("ai_suggest_image").mutation(() => "ok")
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    let caught: unknown;
    try {
      await caller.photo();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TRPCError);
    const err = caught as TRPCError;
    expect(err.code).toBe("FORBIDDEN");
    expect(err.cause).toMatchObject({
      reason: "UPGRADE_REQUIRED",
      feature: "ai_suggest_image"
    });
  });

  it("passes through when the gate resolves", async () => {
    const r = router({ ok: gatedProcedure("ai_suggest_text").mutation(() => "passed") });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.ok()).resolves.toBe("passed");
    expect(gateMock.requireFeatureAccess).toHaveBeenCalledWith("u-1", "ai_suggest_text");
  });
});

describe("rateLimit", () => {
  it("TOO_MANY_REQUESTS with cause.reason=RATE_LIMITED on denial", async () => {
    rateLimitMock.checkAiCallLimit.mockRejectedValueOnce(
      new Error("You've hit your daily AI limit. Try again tomorrow.")
    );
    const r = router({
      ai: protectedProcedure.use(rateLimit("ai")).mutation(() => "ok")
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    let caught: unknown;
    try {
      await caller.ai();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TRPCError);
    const err = caught as TRPCError;
    expect(err.code).toBe("TOO_MANY_REQUESTS");
    expect(err.message).toMatch(/daily AI limit/);
    expect(err.cause).toMatchObject({ reason: "RATE_LIMITED", kind: "ai" });
  });

  it("calls the right helper for each kind", async () => {
    const r = router({
      mutate: protectedProcedure.use(rateLimit("mutation")).mutation(() => "ok"),
      upload: protectedProcedure.use(rateLimit("upload")).mutation(() => "ok"),
      feedback: protectedProcedure.use(rateLimit("feedback")).mutation(() => "ok"),
      invite: protectedProcedure.use(rateLimit("invitation")).mutation(() => "ok"),
      share: protectedProcedure.use(rateLimit("share")).mutation(() => "ok")
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await caller.mutate();
    await caller.upload();
    await caller.feedback();
    await caller.invite();
    await caller.share();
    expect(rateLimitMock.checkMealMutationLimit).toHaveBeenCalledOnce();
    expect(rateLimitMock.checkUploadPresignLimit).toHaveBeenCalledOnce();
    expect(rateLimitMock.checkFeedbackLimit).toHaveBeenCalledOnce();
    expect(rateLimitMock.checkInvitationLimit).toHaveBeenCalledOnce();
    expect(rateLimitMock.checkShareCreationLimit).toHaveBeenCalledOnce();
  });
});

describe("integration: gated + rate limit composition", () => {
  it("gate denial short-circuits before the rate limit runs", async () => {
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new FeatureGateDeniedError("ai_suggest_text")
    );
    const r = router({
      ai: gatedProcedure("ai_suggest_text").use(rateLimit("ai")).mutation(() => "ok")
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.ai()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rateLimitMock.checkAiCallLimit).not.toHaveBeenCalled();
  });

  it("rate limit fires after the gate passes", async () => {
    rateLimitMock.checkAiCallLimit.mockRejectedValueOnce(
      new Error("daily limit reached")
    );
    const r = router({
      ai: gatedProcedure("ai_suggest_text").use(rateLimit("ai")).mutation(() => "ok")
    });
    const caller = createCallerFactory(r)(makeCtx(makeUser()));
    await expect(caller.ai()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(gateMock.requireFeatureAccess).toHaveBeenCalledOnce();
  });
});
