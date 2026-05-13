import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const notificationTypeEnum = pgEnum("notification_type", [
  "rediscovery",
  "neglected_meal",
  "weekly_recap",
  "system"
]);

// In-app notifications surfaced via the topbar bell. Created server-side
// (cron jobs, post-mutation triggers, admin pushes); read state is tracked
// per row so we can show an unread count without per-user state in memory.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    // Optional deep-link to a route inside the app.
    href: text("href"),
    // Free-form structured context (mealId for rediscovery, count for recap,
    // etc). Keep the shape narrow at the call site, not the column.
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    // Most common query: "list this user's notifications, newest first,
    // unread first". Indexed on (userId, createdAt desc) — readAt filtering
    // is applied as a partial expression where useful.
    userCreatedAtIdx: index("notifications_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.readAt)
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
