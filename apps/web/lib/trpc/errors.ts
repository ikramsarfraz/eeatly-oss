"use client";

import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/server/trpc/app-router";
import type { FeatureKey } from "@/lib/gates/registry";

/**
 * Round 11 — typed cause discriminator. Every TRPCError thrown by our
 * procedures carries a structured `cause` object (set by middleware
 * in `server/trpc/trpc.ts`). The client side reads it through
 * `error.data.cause` — this helper narrows the shape so call sites
 * can pattern-match without `as any` casts.
 *
 * Reasons mirror the discriminated-union `code` strings the old
 * server actions returned, so existing UI copy continues to work.
 * The toast/upgrade-prompt machinery in callers stays identical.
 */
export type ProcedureErrorCause =
  | { reason: "UPGRADE_REQUIRED"; feature: FeatureKey }
  | { reason: "RATE_LIMITED"; kind: string }
  | { reason: "UNAUTHENTICATED" }
  | { reason: "NOT_HOUSEHOLD_MEMBER" }
  | { reason: "NOT_HOUSEHOLD_OWNER" }
  | { reason: "FORBIDDEN_ROLE" }
  | { reason: string; [key: string]: unknown };

export type TRPCAnyError = TRPCClientErrorLike<AppRouter>;

/**
 * Read the structured cause from a TRPCClientError. Returns `null`
 * when there isn't one (input-validation errors, unexpected internals).
 */
export function getCause(error: unknown): ProcedureErrorCause | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: unknown } }).data;
  if (!data || typeof data !== "object") return null;
  const cause = (data as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return null;
  if (typeof (cause as { reason?: unknown }).reason !== "string") return null;
  return cause as ProcedureErrorCause;
}

/**
 * Convenience predicates for the most common cause-driven UI branches.
 */
export function isUpgradeRequired(
  error: unknown
): error is { data: { cause: { reason: "UPGRADE_REQUIRED"; feature: FeatureKey } } } {
  return getCause(error)?.reason === "UPGRADE_REQUIRED";
}

export function isRateLimited(error: unknown): boolean {
  return getCause(error)?.reason === "RATE_LIMITED";
}
