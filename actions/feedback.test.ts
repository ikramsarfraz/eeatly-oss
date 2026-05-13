import { beforeEach, describe, expect, it, vi } from "vitest";

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
  checkFeedbackLimit: vi.fn<(userId: string) => Promise<void>>()
}));
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);

const serviceMock = vi.hoisted(() => ({
  createBetaFeedback: vi.fn()
}));
vi.mock("@/services/feedback", () => serviceMock);

// `trackActivationFunnelEvent` writes analytics asynchronously and pulls
// in the db; stub it so we don't drag the env chain.
vi.mock("@/lib/observability/funnel", () => ({
  trackActivationFunnelEvent: () => undefined,
  trackMealLogLifecycleEvent: () => undefined
}));

import { submitFeedbackAction } from "./feedback";

beforeEach(() => {
  rateLimitMock.checkFeedbackLimit.mockReset();
  rateLimitMock.checkFeedbackLimit.mockResolvedValue();
  serviceMock.createBetaFeedback.mockReset();
});

const VALID_INPUT = {
  type: "general" as const,
  message: "the dashboard feels great, two thoughts on the ideas page…",
  context: "/dashboard"
};

describe("submitFeedbackAction discriminated-union surface", () => {
  it("returns INVALID_INPUT when the Zod schema rejects the payload", async () => {
    // Empty message fails the schema's min-length rule.
    const result = await submitFeedbackAction({
      ...VALID_INPUT,
      message: ""
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
    expect(serviceMock.createBetaFeedback).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the feedback throttle fires", async () => {
    rateLimitMock.checkFeedbackLimit.mockRejectedValueOnce(new Error("rate"));
    const result = await submitFeedbackAction(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATE_LIMITED");
    expect(serviceMock.createBetaFeedback).not.toHaveBeenCalled();
  });

  it("returns OTHER when the service throws", async () => {
    serviceMock.createBetaFeedback.mockRejectedValueOnce(new Error("db down"));
    const result = await submitFeedbackAction(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("OTHER");
      expect(result.message).toBe("db down");
    }
  });

  it("returns ok with the feedback id on success", async () => {
    serviceMock.createBetaFeedback.mockResolvedValueOnce({
      id: "fb-1",
      type: "general"
    });
    const result = await submitFeedbackAction(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.feedbackId).toBe("fb-1");
  });
});
