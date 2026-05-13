import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { createNotificationIfNotRecent } from "@/services/notifications";

export type LifecycleCronResult = {
  scanned: number;
  notifiedInactive: number;
  errors: number;
};

const INACTIVE_DAYS = 7;
// Don't refire the same neglected notification within this window. Combined
// with the 7-day inactivity threshold this means at most one nudge per ~week.
const NUDGE_DEDUPE_HOURS = 24 * 6;

type InactiveUser = {
  user_id: string;
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
      if (created) notifiedInactive += 1;
    } catch (error) {
      errors += 1;
      logger.warn("lifecycle_cron_notify_failed", {
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { scanned, notifiedInactive, errors };
}
