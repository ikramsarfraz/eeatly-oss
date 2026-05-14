"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { checkMealMutationLimit } from "@/lib/security/rate-limit";
import {
  addDishToPlanSchema,
  clonePlanSchema,
  createPlanSchema,
  removeDishFromPlanSchema,
  reorderDishesSchema,
  updateDishAnnotationSchema,
  updatePlanSchema,
  type AddDishToPlanInput,
  type ClonePlanInput,
  type CreatePlanInput,
  type RemoveDishFromPlanInput,
  type ReorderDishesInput,
  type UpdateDishAnnotationInput,
  type UpdatePlanInput
} from "@/lib/validators/plans";
import {
  addDishToPlan,
  archivePlan,
  clonePlanFromPast,
  createPlan,
  removeDishFromPlan,
  reorderDishes,
  unarchivePlan,
  updateDishAnnotation,
  updatePlan,
  type ClonePlanResult
} from "@/services/plans";

// All plan actions reuse the meal-mutation budget — plans are sparser
// events than meal logs, and giving them their own bucket would just
// move complexity without changing the throttle's behavior in practice.

export type CreatePlanResult =
  | { ok: true; planId: string }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMITED" | "NOT_AUTHORIZED" | "ERROR";
      message: string;
    };

export async function createPlanAction(
  input: CreatePlanInput
): Promise<CreatePlanResult> {
  const parsed = createPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid plan."
    };
  }
  const { user, household } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a few minutes and try again."
    };
  }
  try {
    const plan = await createPlan({
      householdId: household.id,
      userId: user.id,
      name: parsed.data.name,
      scheduledDate: parsed.data.scheduledDate,
      notes: parsed.data.notes
    });
    revalidatePath("/plans");
    return { ok: true, planId: plan.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't create plan.";
    logger.warn("plan_create_failed", { userId: user.id, error: message });
    return { ok: false, code: "ERROR", message };
  }
}

export type UpdatePlanResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION" | "RATE_LIMITED" | "NOT_FOUND" | "ERROR"; message: string };

export async function updatePlanAction(
  planId: string,
  input: UpdatePlanInput
): Promise<UpdatePlanResult> {
  const parsed = updatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid update."
    };
  }
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a few minutes and try again."
    };
  }
  try {
    await updatePlan({ planId, userId: user.id, patch: parsed.data });
    revalidatePath("/plans");
    revalidatePath(`/plans/${planId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't update plan.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}

export type ArchivePlanResult =
  | { ok: true }
  | { ok: false; code: "RATE_LIMITED" | "NOT_FOUND" | "ERROR"; message: string };

export async function archivePlanAction(planId: string): Promise<ArchivePlanResult> {
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    await archivePlan({ planId, userId: user.id });
    revalidatePath("/plans");
    revalidatePath(`/plans/${planId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't archive plan.";
    return { ok: false, code: "ERROR", message };
  }
}

export async function unarchivePlanAction(planId: string): Promise<ArchivePlanResult> {
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    await unarchivePlan({ planId, userId: user.id });
    revalidatePath("/plans");
    revalidatePath(`/plans/${planId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't unarchive plan.";
    return { ok: false, code: "ERROR", message };
  }
}

export type AddDishResult =
  | { ok: true; planDishId: string }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMITED" | "NOT_FOUND" | "CROSS_HOUSEHOLD" | "ARCHIVED" | "ERROR";
      message: string;
    };

export async function addDishToPlanAction(
  planId: string,
  input: AddDishToPlanInput
): Promise<AddDishResult> {
  const parsed = addDishToPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid request."
    };
  }
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    const dish = await addDishToPlan({
      planId,
      userId: user.id,
      mealId: parsed.data.mealId
    });
    revalidatePath(`/plans/${planId}`);
    return { ok: true, planDishId: dish.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't add dish.";
    if (message.includes("not in this household")) {
      return { ok: false, code: "CROSS_HOUSEHOLD", message };
    }
    if (message.includes("archived")) {
      return { ok: false, code: "ARCHIVED", message };
    }
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}

export type RemoveDishResult =
  | { ok: true }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMITED" | "NOT_FOUND" | "ERROR";
      message: string;
    };

export async function removeDishFromPlanAction(
  planId: string,
  input: RemoveDishFromPlanInput
): Promise<RemoveDishResult> {
  const parsed = removeDishFromPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid request."
    };
  }
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    await removeDishFromPlan({
      planId,
      userId: user.id,
      planDishId: parsed.data.planDishId
    });
    revalidatePath(`/plans/${planId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't remove dish.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}

export type ReorderDishesResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION" | "RATE_LIMITED" | "ERROR"; message: string };

export async function reorderDishesAction(
  planId: string,
  input: ReorderDishesInput
): Promise<ReorderDishesResult> {
  const parsed = reorderDishesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid reorder request."
    };
  }
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    await reorderDishes({
      planId,
      userId: user.id,
      dishIdsInOrder: parsed.data.dishIdsInOrder
    });
    revalidatePath(`/plans/${planId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't reorder dishes.";
    return { ok: false, code: "ERROR", message };
  }
}

// Task 5 — annotation update.
export type UpdateAnnotationResult =
  | { ok: true }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMITED" | "NOT_FOUND" | "ERROR";
      message: string;
    };

export async function updateDishAnnotationAction(
  planDishId: string,
  input: UpdateDishAnnotationInput
): Promise<UpdateAnnotationResult> {
  const parsed = updateDishAnnotationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid annotation."
    };
  }
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    const updated = await updateDishAnnotation({
      planDishId,
      userId: user.id,
      patch: parsed.data
    });
    revalidatePath(`/plans/${updated.planId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't update annotation.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}

// Task 4 — clone from past.
export type ClonePlanActionResult =
  | {
      ok: true;
      newPlanId: string;
      previousAnnotations: ClonePlanResult["previousAnnotations"];
    }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMITED" | "NOT_FOUND" | "ERROR";
      message: string;
    };

export async function clonePlanFromPastAction(
  input: ClonePlanInput
): Promise<ClonePlanActionResult> {
  const parsed = clonePlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid clone request."
    };
  }
  const { user } = await requireCurrentUserWithHousehold();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }
  try {
    const result = await clonePlanFromPast({
      sourcePlanId: parsed.data.sourcePlanId,
      userId: user.id,
      newName: parsed.data.newName,
      newScheduledDate: parsed.data.newScheduledDate
    });
    revalidatePath("/plans");
    return {
      ok: true,
      newPlanId: result.newPlanId,
      previousAnnotations: result.previousAnnotations
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't clone plan.";
    if (message.includes("not found")) {
      return { ok: false, code: "NOT_FOUND", message };
    }
    return { ok: false, code: "ERROR", message };
  }
}
