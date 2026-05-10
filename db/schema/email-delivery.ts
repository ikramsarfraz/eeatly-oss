import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const emailDeliveryStatusEnum = pgEnum("email_delivery_status", [
  "pending",
  "delayed",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "complained",
  "bounced",
  "failed",
  "suppressed"
]);

/** One row per Resend `email_id` / provider message — merged from outbound API + webhook events. */
export const emailDeliveryLogs = pgTable(
  "email_delivery_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerMessageId: text("provider_message_id").notNull().unique(),
    templateKey: text("template_key"),
    recipient: text("recipient").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: emailDeliveryStatusEnum("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    lastProviderEventType: text("last_provider_event_type"),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index("email_delivery_logs_status_idx").on(table.status),
    lastEventAtIdx: index("email_delivery_logs_last_event_at_idx").on(table.lastEventAt),
    userIdIdx: index("email_delivery_logs_user_id_idx").on(table.userId)
  })
);

/** Idempotent webhook ingestion — keyed by Svix `svix-id` on each webhook delivery. */
export const resendWebhookReceipts = pgTable("resend_webhook_receipts", {
  svixId: text("svix_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
});
