import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const analyticsEventNameEnum = pgEnum("analytics_event_name", [
  "signed_up",
  "signed_in",
  "onboarding_completed",
  "meal_logged",
  "meal_logged_again",
  "feedback_submitted",
  "rediscovery_clicked",
  "completed_onboarding",
  "first_meal_logged",
  "second_meal_logged",
  "reminder_email_sent",
  "reminder_email_open_placeholder",
  "reminder_email_clicked_placeholder",
  "email_sent",
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_bounced",
  "email_complained",
  "email_delivery_failed"
]);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: analyticsEventNameEnum("name").notNull(),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userCreatedAtIdx: index("analytics_events_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    nameCreatedAtIdx: index("analytics_events_name_created_at_idx").on(
      table.name,
      table.createdAt
    ),
    createdAtIdx: index("analytics_events_created_at_idx").on(table.createdAt)
  })
);
