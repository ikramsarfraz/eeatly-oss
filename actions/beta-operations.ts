"use server";

import { revalidatePath } from "next/cache";
import { differenceInCalendarDays } from "date-fns";
import { eq, max } from "drizzle-orm";

import { requirePlatformAdmin } from "@/lib/auth/session";
import { mealLogs, users } from "@/db/schema";
import {
  dispatchTransactionalEmail,
  type TransactionalTemplate
} from "@/lib/email/transactional";
import { logger } from "@/lib/observability/logger";
import { trackEvent } from "@/lib/observability/analytics";
import { parseBetaCohortFormValue } from "@/lib/validators/beta-cohort";
import { db } from "@/lib/db/client";
import { updateUserBetaCohort } from "@/services/user-lifecycle";

async function loadUserProfile(userId: string) {
  const [record] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return record ?? null;
}

export async function adminUpdateBetaCohortAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const cohort = parseBetaCohortFormValue(formData.get("cohort"));

  if (!userId) {
    logger.warn("admin_beta_cohort_missing_user", {});
    return;
  }

  await updateUserBetaCohort(userId, cohort);
  revalidatePath("/admin/users");
  logger.info("admin_beta_cohort_updated", { userId, cohort });
}

const templateWhitelist: TransactionalTemplate[] = [
  "welcome",
  "first_meal_encouragement",
  "inactive_reminder",
  "weekly_recap_placeholder"
];

function parseTemplate(value: string): TransactionalTemplate | null {
  return templateWhitelist.includes(value as TransactionalTemplate)
    ? (value as TransactionalTemplate)
    : null;
}

async function lastMealTimestamp(userId: string) {
  const [row] = await db
    .select({ lastAt: max(mealLogs.createdAt) })
    .from(mealLogs)
    .where(eq(mealLogs.cookedByUserId, userId));

  return row?.lastAt ?? null;
}

export async function adminDispatchLifecycleEmailAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const template = parseTemplate(String(formData.get("template") ?? ""));

  if (!userId || !template) {
    logger.warn("admin_lifecycle_email_invalid", {});
    return;
  }

  const user = await loadUserProfile(userId);

  if (!user) {
    logger.warn("admin_lifecycle_email_unknown_user", { userId });
    return;
  }

  let daysQuiet: number | null = null;

  if (template === "inactive_reminder") {
    const last = await lastMealTimestamp(userId);
    daysQuiet = last ? differenceInCalendarDays(new Date(), last) : null;
  }

  const recapTeaserRaw = String(formData.get("recapTeaser") ?? "")
    .trim()
    .slice(0, 240);

  const result = await dispatchTransactionalEmail({
    template,
    toEmail: user.email,
    toName: user.name?.trim() || user.email.split("@")[0] || "eeatly friend",
    userId,
    daysQuiet,
    recapTeaser: template === "weekly_recap_placeholder" && recapTeaserRaw.length > 0 ? recapTeaserRaw : undefined,
    trackDispatch: true
  });

  revalidatePath("/admin/users");
  logger.info("admin_lifecycle_email_dispatched", {
    userId,
    template,
    skipped: result.skipped,
    detail: result.detail
  });
}

export async function adminTrackReminderOpenPlaceholderAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    logger.warn("admin_reminder_open_missing_user", {});
    return;
  }

  trackEvent({
    name: "reminder_email_open_placeholder",
    userId,
    metadata: { source: "admin_manual" }
  });

  logger.info("admin_reminder_open_placeholder", { userId });
}

export async function adminTrackReminderClickPlaceholderAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    logger.warn("admin_reminder_click_missing_user", {});
    return;
  }

  trackEvent({
    name: "reminder_email_clicked_placeholder",
    userId,
    metadata: { source: "admin_manual" }
  });

  logger.info("admin_reminder_click_placeholder", { userId });
}
