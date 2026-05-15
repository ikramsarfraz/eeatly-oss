/**
 * Round 12 — literal-union enum types that flow through the tRPC
 * contract. Co-located here so both web and mobile reference the same
 * source of truth. The corresponding Zod schemas live in
 * `packages/api/src/validators/`.
 *
 * Keep this file deps-free. No `server-only`, no `@/types` reaches
 * back into the web app, no runtime code.
 */

export type EffortLevel = "quick" | "easy" | "medium" | "high_effort";

export type UserRole = "root_app_user" | "tenant_user" | "platform_admin";

export type TenantRole = "owner" | "admin" | "member";

export type BetaCohort =
  | "alpha"
  | "beta_wave_1"
  | "beta_wave_2"
  | "internal"
  | "beta_2026";
