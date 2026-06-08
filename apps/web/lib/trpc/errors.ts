"use client";

import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/server/trpc/app-router";
import type { FeatureKey } from "@eeatly/api/gates/registry";

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

/**
 * A human-readable message for an input-validation (Zod) failure. tRPC sets a
 * BAD_REQUEST error's `message` to the serialized ZodError issue list, so a
 * naive `error.message` renders a raw JSON array to the user. This pulls the
 * first issue's `message` (e.g. "Step text is too long.") out of that array.
 * Returns null when the error isn't a serialized validation failure, so callers
 * can fall back to their generic copy.
 */
export function validationMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const raw = error.message?.trim();
  if (!raw || raw[0] !== "[") return null;
  try {
    const issues = JSON.parse(raw);
    if (Array.isArray(issues)) {
      const withMessage = issues.find((i) => typeof i?.message === "string");
      if (withMessage) return withMessage.message as string;
    }
  } catch {
    // Not a serialized ZodError — let the caller use its fallback.
  }
  return null;
}
