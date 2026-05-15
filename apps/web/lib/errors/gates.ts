import type { FeatureKey } from "@/lib/gates/registry";

/**
 * Round 6: thrown by `requireFeatureAccess(userId, feature)` when the
 * gate evaluates to false. Action layer catches and converts to a
 * `{ ok: false; code: 'UPGRADE_REQUIRED'; feature }` discriminated
 * union the UI uses to show the upgrade prompt.
 */
export class FeatureGateDeniedError extends Error {
  readonly code = "FEATURE_GATED" as const;
  readonly feature: FeatureKey;
  constructor(feature: FeatureKey) {
    super(`Access to feature "${feature}" is gated.`);
    this.feature = feature;
    this.name = "FeatureGateDeniedError";
  }
}
