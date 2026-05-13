"use server";

import { and, eq, isNull } from "drizzle-orm";
import { users } from "@/db/schema";
import { db } from "@/lib/db/client";
import { requireCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { trackEvent, type AnalyticsEventName, type AnalyticsMetadata } from "@/lib/observability/analytics";

export async function trackAuthFunnelAction(
  name: Extract<AnalyticsEventName, "signed_in" | "signed_up">
) {
  const meta: AnalyticsMetadata = { stage: "magic_link_requested" };

  if (name === "signed_up") {
    trackActivationFunnelEvent("signed_up", { metadata: meta });
    return { ok: true };
  }

  trackEvent({ name: "signed_in", metadata: meta });

  return { ok: true };
}

export async function trackUserEventAction(
  name: Extract<
    AnalyticsEventName,
    "completed_onboarding" | "onboarding_completed" | "rediscovery_clicked" | "signed_in"
  >,
  metadata?: AnalyticsMetadata
) {
  const user = await requireCurrentUser();

  if (name === "completed_onboarding") {
    // Authoritative onboarding signal: write to users.onboardingCompletedAt.
    // The analytics event remains for funnel analysis, but admin retention
    // queries now derive completion from the column. Only set the timestamp
    // once — re-firing the action (which can happen on hot-reloads) shouldn't
    // overwrite the original completion time.
    try {
      await db
        .update(users)
        .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(users.id, user.id), isNull(users.onboardingCompletedAt)));
    } catch (error) {
      logger.warn("onboarding_completion_write_failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    trackActivationFunnelEvent("completed_onboarding", {
      userId: user.id,
      metadata
    });

    return { ok: true };
  }

  if (name === "rediscovery_clicked") {
    trackActivationFunnelEvent("rediscovery_clicked", {
      userId: user.id,
      metadata
    });

    return { ok: true };
  }

  trackEvent({ name, userId: user.id, metadata });

  return { ok: true };
}
