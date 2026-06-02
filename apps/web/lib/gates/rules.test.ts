import { describe, expect, it } from "vitest";
import { ruleEvaluators, type GateContext } from "@eeatly/api/gates/rules";

const baseCtx: GateContext = {
  userId: "u-1",
  role: "root_app_user",
  betaCohort: null,
  subscriptionStatus: null,
  tier: "free",
  allowlistedUserIds: [],
  envFlags: {},
  launchFreeAccess: false
};

describe("ruleEvaluators", () => {
  it("paid_only allows Plus and Pro tiers", () => {
    expect(ruleEvaluators.paid_only({ ...baseCtx, tier: "plus" }, "x")).toBe(true);
    expect(ruleEvaluators.paid_only({ ...baseCtx, tier: "pro" }, "x")).toBe(true);
  });

  it("paid_only denies the free tier", () => {
    expect(ruleEvaluators.paid_only({ ...baseCtx, tier: "free" }, "x")).toBe(false);
  });

  it("pro_only allows only the Pro tier (incl. trial)", () => {
    expect(ruleEvaluators.pro_only({ ...baseCtx, tier: "pro" }, "x")).toBe(true);
    expect(ruleEvaluators.pro_only({ ...baseCtx, tier: "plus" }, "x")).toBe(false);
    expect(ruleEvaluators.pro_only({ ...baseCtx, tier: "free" }, "x")).toBe(false);
  });

  it("beta_or_paid allows either cohort or any paid tier", () => {
    expect(
      ruleEvaluators.beta_or_paid({ ...baseCtx, betaCohort: "beta_2026" }, "x")
    ).toBe(true);
    expect(ruleEvaluators.beta_or_paid({ ...baseCtx, tier: "plus" }, "x")).toBe(true);
    expect(ruleEvaluators.beta_or_paid({ ...baseCtx, tier: "pro" }, "x")).toBe(true);
    // Free with no cohort isn't a free pass.
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
