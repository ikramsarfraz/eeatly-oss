"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import type { FeatureKey } from "@/lib/gates/registry";
import { logger } from "@/lib/observability/logger";
import { checkShareCreationLimit } from "@/lib/security/rate-limit";
import {
  createRecipeShareSchema,
  revokeRecipeShareSchema,
  type CreateRecipeShareInput,
  type RevokeRecipeShareInput
} from "@/lib/validators/shares";
import {
  createRecipeShare,
  listSharesForMeal,
  revokeRecipeShare
} from "@/services/shares";

/**
 * Round 7 — public share-link actions. Discriminated-union returns
 * match the Round 4 pattern. `UPGRADE_REQUIRED` is translated from the
 * service's typed `FeatureGateDeniedError` (set by
 * `requireFeatureAccess(userId, "recipe_share_create")`).
 *
 * Rate limit uses the dedicated `checkShareCreationLimit` (20/day) —
 * see `lib/security/rate-limit.ts` for the rationale. The idempotent
 * service means re-clicks on the same meal don't consume a slot when
 * the share already exists — but `checkShareCreationLimit` fires
 * before that branch, so heavy re-clickers still burn budget.
 */

export type CreateShareResult =
  | { ok: true; shareId: string; url: string }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "RATE_LIMITED"
        | "NOT_FOUND"
        | "ARCHIVED"
        | "UPGRADE_REQUIRED"
        | "ERROR";
      message: string;
      feature?: FeatureKey;
    };

export async function createRecipeShareAction(
  input: CreateRecipeShareInput
): Promise<CreateShareResult> {
  const parsed = createRecipeShareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid share request."
    };
  }

  const user = await requireCurrentUser();
  try {
    await checkShareCreationLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many share links created today. Try again tomorrow."
    };
  }

  try {
    const result = await createRecipeShare({
      userId: user.id,
      mealId: parsed.data.mealId
    });
    return { ok: true, shareId: result.shareId, url: result.url };
  } catch (error) {
    if (error instanceof FeatureGateDeniedError) {
      return {
        ok: false,
        code: "UPGRADE_REQUIRED",
        message: error.message,
        feature: error.feature
      };
    }
    const message = error instanceof Error ? error.message : "Couldn't create share.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    if (message.includes("archived")) {
      return { ok: false, code: "ARCHIVED", message };
    }
    logger.warn("share_create_failed", { userId: user.id, error: message });
    return { ok: false, code: "ERROR", message: "Couldn't create share link." };
  }
}

export type RevokeShareResult =
  | { ok: true }
  | {
      ok: false;
      code: "VALIDATION" | "NOT_FOUND" | "ERROR";
      message: string;
    };

export async function revokeRecipeShareAction(
  input: RevokeRecipeShareInput
): Promise<RevokeShareResult> {
  const parsed = revokeRecipeShareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid request."
    };
  }
  const user = await requireCurrentUser();
  try {
    await revokeRecipeShare({ userId: user.id, shareId: parsed.data.shareId });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't revoke share.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}

/**
 * Read-only — used by the share dialog on open to detect an existing
 * active share. Returns null when no share exists yet (the dialog
 * surfaces a "Create share link" CTA in that case).
 */
export type GetShareForMealResult =
  | {
      ok: true;
      share: { shareId: string; url: string } | null;
    }
  | { ok: false; code: "NOT_FOUND" | "ERROR"; message: string };

export async function getShareForMealAction(input: {
  mealId: string;
}): Promise<GetShareForMealResult> {
  const user = await requireCurrentUser();
  try {
    const rows = await listSharesForMeal({
      userId: user.id,
      mealId: input.mealId
    });
    return {
      ok: true,
      share: rows.length > 0 ? { shareId: rows[0]!.id, url: rows[0]!.url } : null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't load share.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    logger.warn("share_lookup_failed", { userId: user.id, error: message });
    return { ok: false, code: "ERROR", message };
  }
}

// Re-export for typed callers (e.g., revalidate hooks).
export { revalidatePath };
