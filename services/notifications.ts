import "server-only";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { notifications, type NewNotification, type Notification } from "@/db/schema";
import { db } from "@/lib/db/client";

export type NotificationDTO = Pick<
  Notification,
  "id" | "type" | "title" | "body" | "href" | "createdAt" | "readAt"
> & { payload: Record<string, unknown> | null };

function toDTO(row: Notification): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt,
    readAt: row.readAt,
    payload: (row.payload as Record<string, unknown> | null) ?? null
  };
}

const DEFAULT_LIMIT = 25;

export async function listNotificationsForUser(
  userId: string,
  options: { limit?: number; onlyUnread?: boolean } = {}
): Promise<{ rows: NotificationDTO[]; unreadCount: number }> {
  const limit = Math.max(1, Math.min(100, options.limit ?? DEFAULT_LIMIT));

  const where = options.onlyUnread
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : eq(notifications.userId, userId);

  const [rows, unreadCount] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ value: count(notifications.id) })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  ]);

  return {
    rows: rows.map(toDTO),
    unreadCount: Number(unreadCount[0]?.value ?? 0)
  };
}

export async function createNotification(input: NewNotification): Promise<NotificationDTO> {
  const [row] = await db.insert(notifications).values(input).returning();
  if (!row) {
    throw new Error("Failed to create notification.");
  }
  return toDTO(row);
}

/**
 * Marks a single notification read iff it belongs to the caller's user.
 * Returns the updated row; throws if the row doesn't exist or belongs to
 * a different user (so we don't leak existence info via a no-op success).
 */
export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id });

  if (!updated) {
    // Could be: already read, doesn't exist, or belongs to someone else.
    // Don't distinguish — leaks nothing useful.
    throw new Error("Notification not found.");
  }
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  return updated.length;
}

/**
 * Idempotency helper for cron-style creation: skip insert if a similar
 * notification was created for this user recently. Useful for
 * neglected-meal nudges that shouldn't fire daily for the same meal.
 */
export async function createNotificationIfNotRecent(
  input: NewNotification,
  withinHours: number
): Promise<NotificationDTO | null> {
  const cutoff = sql`now() - (${withinHours} || ' hours')::interval`;
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, input.userId),
        eq(notifications.type, input.type),
        eq(notifications.title, input.title),
        sql`${notifications.createdAt} > ${cutoff}`
      )
    )
    .limit(1);

  if (existing.length > 0) return null;
  return createNotification(input);
}
