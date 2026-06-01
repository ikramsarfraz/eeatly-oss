import type { GateRule } from "./rules";

/**
 * Round 6 — feature-gate registry. Every gated feature has exactly one
 * entry here. The string-literal union of keys is what callers reference
 * everywhere (`can(userId, 'ai_share_recipe')`), so TS catches typos
 * across the codebase.
 *
 * Adding a feature:
 *   1. Add a key + config below. `description` shows on /admin/features
 *      and is reused on the pricing-comparison list.
 *   2. Pick a `defaultRule` — TS forces it explicit so we can't
 *      accidentally ship an unprotected feature.
 *   3. (Optionally) call `requireFeatureAccess(userId, key)` at the
 *      service entry to enforce the gate server-side.
 *
 * `defaultRule` is the LAST input the resolver consults — see
 * `lib/gates/resolver.ts` for the full precedence order. Override rules
 * stored in the `feature_overrides` table win over the default; admin
 * role and per-user allowlists win over everything.
 */
export const FEATURE_REGISTRY = {
  // AI features are OPEN — anyone can reach them. Usage is metered by AI
  // credits (lib/pricing.ts + services/ai-credits.ts), not a paywall: free
  // users get a small monthly grant and can buy top-ups, while Plus/Pro
  // include larger grants. The gate stays registered so admin overrides can
  // still force-deny a specific user/cohort.
  ai_suggest_image: {
    description: "AI: suggest meal details from a photo",
    defaultRule: "open" as GateRule
  },
  ai_suggest_text: {
    description: "AI: suggest meal details from pasted text",
    defaultRule: "open" as GateRule
  },
  ai_share_recipe: {
    description: "AI: generate a shareable recipe message",
    defaultRule: "open" as GateRule
  },
  household_create: {
    description: "Create a shared household",
    defaultRule: "beta_or_paid" as GateRule
  },
  household_invite: {
    description: "Invite people to your household",
    defaultRule: "beta_or_paid" as GateRule
  },
  plans_create: {
    description: "Create plans (occasions)",
    defaultRule: "beta_or_paid" as GateRule
  },
  plans_clone: {
    description: "Clone past plans with annotation hints",
    defaultRule: "beta_or_paid" as GateRule
  },
  recipe_share_create: {
    description: "Share recipes with anyone via a public link",
    defaultRule: "beta_or_paid" as GateRule
  },
  ai_suggest_voice: {
    description: "Extract recipes from voice notes",
    defaultRule: "open" as GateRule
  }
} as const satisfies Record<string, { description: string; defaultRule: GateRule }>;

export type FeatureKey = keyof typeof FEATURE_REGISTRY;

export const FEATURE_KEYS = Object.keys(FEATURE_REGISTRY) as FeatureKey[];

export function isFeatureKey(value: string): value is FeatureKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_REGISTRY, value);
}
