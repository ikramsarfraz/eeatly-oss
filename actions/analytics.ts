"use server";

import { requireCurrentUser } from "@/lib/auth/session";
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
