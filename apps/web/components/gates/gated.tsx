import "server-only";
import * as React from "react";
import { can } from "@/lib/gates/resolver";
import { getCurrentUser } from "@/lib/auth/session";
import type { FeatureKey } from "@eeatly/api/gates/registry";

type GatedProps = {
  feature: FeatureKey;
  children: React.ReactNode;
  /**
   * Rendered when the gate denies. Common pattern is an inline
   * `<UpgradePrompt>`; pass `null` for a clean hide.
   */
  fallback?: React.ReactNode;
};

/**
 * Round 6 — server component that conditionally renders children based
 * on the calling user's gate for `feature`. Resolves server-side via
 * `can()`, which is React-cache-memoized; rendering multiple `<Gated>`
 * blocks for the same feature in one request hits the DB once.
 *
 * Falls back to a clean hide when there's no session — gates are meant
 * to be wrapped inside authenticated routes, but a missing session is
 * treated as "no access" rather than a crash, so this stays drop-in
 * safe in public surfaces too.
 */
export async function Gated({ feature, children, fallback = null }: GatedProps) {
  const user = await getCurrentUser();
  if (!user) return <>{fallback}</>;

  const allowed = await can(user.id, feature);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
