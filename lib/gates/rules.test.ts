import { describe, expect, it } from "vitest";
import { ruleEvaluators, type GateContext } from "./rules";

const baseCtx: GateContext = {
  userId: "u-1",
  role: "root_app_user",
  betaCohort: null,
  subscriptionStatus: null,
  allowlistedUserIds: [],
  envFlags: {}
};

describe("ruleEvaluators", () => {
  it("paid_only allows active subscriptions", () => {
    expect(ruleEvaluators.paid_only({ ...baseCtx, subscriptionStatus: "active" }, "x")).toBe(true);
    expect(ruleEvaluators.paid_only({ ...baseCtx, subscriptionStatus: "trialing" }, "x")).toBe(true);
  });

  it("paid_only denies cancellation, past_due, etc.", () => {
    expect(ruleEvaluators.paid_only({ ...baseCtx, subscriptionStatus: "canceled" }, "x")).toBe(false);
    expect(ruleEvaluators.paid_only({ ...baseCtx, subscriptionStatus: "past_due" }, "x")).toBe(false);
    expect(ruleEvaluators.paid_only({ ...baseCtx, subscriptionStatus: null }, "x")).toBe(false);
  });

  it("beta_or_paid allows either cohort or active sub", () => {
    expect(
      ruleEvaluators.beta_or_paid({ ...baseCtx, betaCohort: "beta_2026" }, "x")
    ).toBe(true);
    expect(
      ruleEvaluators.beta_or_paid({ ...baseCtx, subscriptionStatus: "active" }, "x")
    ).toBe(true);
    // Past-due isn't a free pass.
    expect(
      ruleEvaluators.beta_or_paid({ ...baseCtx, subscriptionStatus: "past_due" }, "x")
    ).toBe(false);
    expect(ruleEvaluators.beta_or_paid(baseCtx, "x")).toBe(false);
  });

  it("admin_only only allows platform_admin role", () => {
    expect(ruleEvaluators.admin_only({ ...baseCtx, role: "platform_admin" }, "x")).toBe(true);
    expect(ruleEvaluators.admin_only({ ...baseCtx, role: "root_app_user" }, "x")).toBe(false);
    expect(ruleEvaluators.admin_only({ ...baseCtx, role: "tenant_user" }, "x")).toBe(false);
  });

  it("allowlist matches when the user id is in the list", () => {
    expect(
      ruleEvaluators.allowlist({ ...baseCtx, allowlistedUserIds: ["u-1", "u-2"] }, "x")
    ).toBe(true);
    expect(
      ruleEvaluators.allowlist({ ...baseCtx, allowlistedUserIds: ["u-3"] }, "x")
    ).toBe(false);
  });

  it("env_flag consults the per-feature flag key", () => {
    expect(
      ruleEvaluators.env_flag({ ...baseCtx, envFlags: { my_feature: true } }, "my_feature")
    ).toBe(true);
    expect(
      ruleEvaluators.env_flag({ ...baseCtx, envFlags: { other: true } }, "my_feature")
    ).toBe(false);
  });

  it("open always allows", () => {
    expect(ruleEvaluators.open(baseCtx, "x")).toBe(true);
  });
});
