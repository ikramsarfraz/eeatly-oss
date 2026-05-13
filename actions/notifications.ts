"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead
} from "@/services/notifications";

export async function listNotificationsAction(options?: { onlyUnread?: boolean }) {
  const user = await requireCurrentUser();
  return listNotificationsForUser(user.id, options);
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireCurrentUser();
  await markNotificationRead(user.id, notificationId);
  revalidatePath("/dashboard");
}

export async function markAllNotificationsReadAction() {
  const user = await requireCurrentUser();
  const updated = await markAllNotificationsRead(user.id);
  revalidatePath("/dashboard");
  return { updated };
}
