import "server-only";

import { createAnalyticsEvent } from "@/services/analytics";
import { logger } from "@/lib/observability/logger";

export type AnalyticsEventName =
  | "signed_up"
  | "signed_in"
  | "completed_onboarding"
  | "first_meal_logged"
  | "second_meal_logged"
  | "meal_logged"
  | "meal_logged_again"
  | "feedback_submitted"
  | "rediscovery_clicked"
  | "onboarding_completed"
  | "reminder_email_sent"
  | "reminder_email_open_placeholder"
  | "reminder_email_clicked_placeholder"
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "email_bounced"
  | "email_complained"
  | "email_delivery_failed";

export type AnalyticsMetadata = Record<string, string | number | boolean | null>;

type AnalyticsEvent = {
  name: AnalyticsEventName;
  userId?: string;
  metadata?: AnalyticsMetadata;
};

export function trackEvent(event: AnalyticsEvent) {
  void createAnalyticsEvent(event).catch((error) => {
    logger.warn("analytics_event_failed", {
      event: event.name,
      error: error instanceof Error ? error.message : "Unknown analytics error"
    });
  });
}
