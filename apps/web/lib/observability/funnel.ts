import "server-only";

import { trackEvent, type AnalyticsMetadata } from "@/lib/observability/analytics";

/**
 * Ordered funnel steps tracked for activation reporting in admin analytics.
 * Event names correspond to Postgres `analytics_event_name` values.
 */
export const ACTIVATION_FUNNEL_STEPS = [
  "signed_up",
  "completed_onboarding",
  "first_meal_logged",
  "second_meal_logged",
  "rediscovery_clicked",
  "feedback_submitted"
] as const;

export type ActivationFunnelStep = (typeof ACTIVATION_FUNNEL_STEPS)[number];

export function trackActivationFunnelEvent(
  name: ActivationFunnelStep,
  input: { userId?: string; metadata?: AnalyticsMetadata }
) {
  trackEvent({ name, userId: input.userId, metadata: input.metadata });
}

export function trackMealLogLifecycleEvent(input: {
  userId: string;
  mealLogCount: number;
  effortLevel: string;
  source: "quick_log" | "log_again";
}) {
  const baseMeta: AnalyticsMetadata = {
    source: input.source,
    effortLevel: input.effortLevel
  };

  trackEvent({
    name: input.source === "log_again" ? "meal_logged_again" : "meal_logged",
    userId: input.userId,
    metadata: baseMeta
  });

  if (input.mealLogCount === 1) {
    trackActivationFunnelEvent("first_meal_logged", {
      userId: input.userId,
      metadata: baseMeta
    });
    return;
  }

  if (input.mealLogCount === 2) {
    trackActivationFunnelEvent("second_meal_logged", {
      userId: input.userId,
      metadata: baseMeta
    });
  }
}
