"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { getRequestId } from "@/lib/observability/request-id";
import {
  onboardingHabitsInputSchema,
  type OnboardingHabitsInput
} from "@/lib/validators/onboarding";

/**
 * Step 2 — persist cooking habits. Safe to call multiple times (HMR reruns,
 * back/next navigation): we always overwrite the latest values. We do NOT
 * mark onboarding completed here — that happens on the final step.
 */
export async function saveOnboardingHabitsAction(input: OnboardingHabitsInput) {
  const user = await requireCurrentUser();
  const parsed = onboardingHabitsInputSchema.parse(input);

  try {
    await db
      .update(users)
      .set({
        cooksPerWeek: parsed.cooksPerWeek,
        weeknightEffort: parsed.weeknightEffort,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));
  } catch (error) {
    logger.warn("onboarding_habits_save_failed", {
      requestId: (await getRequestId()) ?? undefined,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error("Couldn't save your cooking habits. Please try again.");
  }

  return { ok: true } as const;
}

/**
 * Final step — mark onboarding complete. Guarded by `WHERE onboarding_completed_at
 * IS NULL` so re-firing (race with HMR / back+forward / refresh) doesn't
 * stomp the original completion time. Also fires the activation funnel
 * event for analytics.
 */
export async function completeOnboardingAction() {
  const user = await requireCurrentUser();

  try {
    await db
      .update(users)
      .set({
        onboardingCompletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(users.id, user.id), isNull(users.onboardingCompletedAt)));
  } catch (error) {
    logger.warn("onboarding_completion_write_failed", {
      requestId: (await getRequestId()) ?? undefined,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
    // Non-fatal — still navigate the user out of /onboarding. The
    // analytics event below remains useful even if the write didn't land.
  }

  trackActivationFunnelEvent("completed_onboarding", {
    userId: user.id,
    metadata: { source: "multi_step_flow" }
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
