import "server-only";

import { differenceInDays } from "date-fns";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dispatchTransactionalEmail } from "@/lib/email/transactional";
import { logger } from "@/lib/observability/logger";
import { createNotificationIfNotRecent } from "@/services/notifications";

export type LifecycleCronResult = {
  scanned: number;
  notifiedInactive: number;
  emailed: number;
  errors: number;
};

const INACTIVE_DAYS = 7;
// Don't refire the same neglected notification within this window. Combined
// with the 7-day inactivity threshold this means at most one nudge per ~week.
const NUDGE_DEDUPE_HOURS = 24 * 6;

type InactiveUser = {
  user_id: string;
  email: string;
  name: string;
  last_meal_at: Date | null;
  meal_count: number;
};

/**
 * Daily lifecycle pass. For each onboarded user who has cooked at least once
 * but hasn't logged anything in `INACTIVE_DAYS`, create an in-app notification
 * nudging them toward the rediscovery surface.
 *
 * Idempotent at the row level — `createNotificationIfNotRecent` skips when
 * a matching notification already exists in the dedup window, so a late or
 * doubled cron run won't spam.
 *
 * Run from Vercel Cron via `/api/cron/lifecycle`, gated by `CRON_SECRET`.
 */
export async function runLifecycleNudges(): Promise<LifecycleCronResult> {
  // For beta cohort sizes this single aggregate scan is cheap. At larger
  // scale, swap for a cursor-paged version, or filter at the SQL layer
  // (e.g. `having max(cooked_at) <= now() - interval '7 days'`).
  const result = await db.execute<InactiveUser>(sql`
    select
      u.id as user_id,
      u.email as email,
      u.name as name,
      max(ml.cooked_at::timestamp) as last_meal_at,
      count(ml.id)::int as meal_count
    from "user" u
    left join meal_logs ml on ml.user_id = u.id and ml.deleted_at is null
    where u.onboarding_completed_at is not null
    group by u.id
    having max(ml.cooked_at::timestamp) <= now() - (${INACTIVE_DAYS} || ' days')::interval
       and count(ml.id) > 0
  `);

  // pg drivers expose results as `.rows` on a QueryResult; the Drizzle
  // wrapper preserves that shape. We cast through unknown rather than
  // chase a precise driver-specific type — the shape is stable in practice.
  const rows: InactiveUser[] =
    (result as unknown as { rows?: InactiveUser[] }).rows
    ?? (Array.isArray(result) ? (result as InactiveUser[]) : []);

  let scanned = 0;
  let notifiedInactive = 0;
  let emailed = 0;
  let errors = 0;

  for (const row of rows) {
    scanned += 1;
    try {
      const created = await createNotificationIfNotRecent(
        {
          userId: row.user_id,
          type: "neglected_meal",
          title: "Haven't cooked in a while?",
          body: "Tap to see meals worth bringing back tonight.",
          href: "/ideas"
        },
        NUDGE_DEDUPE_HOURS
      );

      if (!created) {
        // In-app dedup hit — skip email too. Both surfaces share the same
        // cadence so a user doesn't get hit on one channel while we
        // suppressed the other.
        continue;
      }

      notifiedInactive += 1;

      // Email goes out alongside the in-app notification. `dispatchTransactionalEmail`
      // skips internally when RESEND_API_KEY / EMAIL_FROM aren't configured —
      // useful for the cron run during a dry-run deploy.
      const daysQuiet = row.last_meal_at
        ? Math.max(INACTIVE_DAYS, differenceInDays(new Date(), row.last_meal_at))
        : INACTIVE_DAYS;

      // Round 9: surface a few specific dishes worth bringing back. We
      // pick from the user's OWN logs (cooked_by_user_id) so the email
      // is "your kitchen", not the household's; the rest of the email
      // is per-user-toned the same way.
      const neglectedMealNames = await getUserNeglectedMealNames(row.user_id, 3);

      try {
        const dispatch = await dispatchTransactionalEmail({
          template: "inactive_reminder",
          toEmail: row.email,
          toName: row.name,
          userId: row.user_id,
          daysQuiet,
          neglectedMealNames,
          trackDispatch: true
        });
        if (!dispatch.skipped) emailed += 1;
      } catch (error) {
        // Email failure shouldn't break the cron — log + move on. The
        // in-app notification still gives the user a path back in.
        errors += 1;
        logger.warn("lifecycle_cron_email_failed", {
          userId: row.user_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      errors += 1;
      logger.warn("lifecycle_cron_notify_failed", {
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { scanned, notifiedInactive, emailed, errors };
}

type NeglectedMealRow = { meal_name: string };

/**
 * Round 9 — pull the top N dish names the user has cooked least recently
 * (lowest `max(cooked_at)` per meal) from their own logs. Used in the
 * inactive-reminder email to surface concrete dishes worth bringing back.
 *
 * Per-user query inside the cron loop is fine at beta scale. At larger
 * volumes, lift into a single batch JOIN keyed on user_id LATERAL.
 */
export async function getUserNeglectedMealNames(
  userId: string,
  limit: number
): Promise<readonly string[]> {
  try {
    const result = await db.execute<NeglectedMealRow>(sql`
      select m.name as meal_name
      from meals m
      inner join meal_logs ml on ml.meal_id = m.id and ml.deleted_at is null
      where ml.cooked_by_user_id = ${userId}
        and m.archived_at is null
      group by m.id, m.name
      order by max(ml.cooked_at) asc nulls first
      limit ${limit}
    `);
    const rows: NeglectedMealRow[] =
      (result as unknown as { rows?: NeglectedMealRow[] }).rows
      ?? (Array.isArray(result) ? (result as NeglectedMealRow[]) : []);
    return rows.map((r) => r.meal_name).filter(Boolean);
  } catch (error) {
    // A failure to fetch the dish list shouldn't block the email — the
    // template renders fine with an empty array (general CTA, no list).
    logger.warn("neglected_meal_names_lookup_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}
