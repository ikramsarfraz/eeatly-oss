"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { FEATURE_REGISTRY, isFeatureKey } from "@/lib/gates/registry";
import { GATE_RULES, type GateRule } from "@/lib/gates/rules";
import {
  createOverride,
  deleteOverride
} from "@/services/feature-overrides";

const featureKeyValidator = z
  .string()
  .refine((v) => isFeatureKey(v), { message: "Unknown feature key." });

const createOverrideSchema = z
  .object({
    feature: featureKeyValidator,
    ruleOverride: z.enum(GATE_RULES),
    userId: z.string().min(1).max(128).optional(),
    cohort: z.string().min(1).max(128).optional()
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.cohort), {
    message: "Provide exactly one of userId or cohort."
  });

export type CreateOverrideResult =
  | { ok: true; id: string }
  | { ok: false; code: "VALIDATION" | "ERROR"; message: string };

export async function createOverrideAction(input: {
  feature: string;
  ruleOverride: GateRule;
  userId?: string;
  cohort?: string;
}): Promise<CreateOverrideResult> {
  const admin = await requirePlatformAdmin();
  const parsed = createOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid override."
    };
  }
  try {
    // The refine above guarantees the feature string is a FeatureKey at
    // runtime; safe to assert through the registry.
    if (!isFeatureKey(parsed.data.feature)) {
      return { ok: false, code: "VALIDATION", message: "Unknown feature key." };
    }
    const created = await createOverride({
      feature: parsed.data.feature,
      ruleOverride: parsed.data.ruleOverride,
      userId: parsed.data.userId,
      cohort: parsed.data.cohort,
      createdByUserId: admin.id
    });
    revalidatePath("/admin/features");
    revalidatePath(`/admin/features/${parsed.data.feature}`);
    return { ok: true, id: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't create override.";
    logger.warn("feature_override_create_failed", { adminId: admin.id, error: message });
    return { ok: false, code: "ERROR", message };
  }
}

export type DeleteOverrideResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "ERROR"; message: string };

export async function deleteOverrideAction(overrideId: string): Promise<DeleteOverrideResult> {
  const admin = await requirePlatformAdmin();
  try {
    await deleteOverride({ id: overrideId, deletedByUserId: admin.id });
    revalidatePath("/admin/features");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't delete override.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}

// Re-export feature registry surface so the admin UI can build its
// dropdown without reaching directly into lib/gates/.
export { FEATURE_REGISTRY };
