import "server-only";

import { eq, and, inArray, sql } from "drizzle-orm";
import { ONBOARDING_ANALYTICS_EVENT_NAMES } from "@/lib/analytics/onboarding-events";
import { analyticsEvents, betaFeedback, mealLogs, users } from "@/db/schema";
import type { BetaCohort } from "@/types";
import { db } from "@/lib/db/client";
import {
  computeRetentionStatus,
  type RetentionStatus
} from "@/lib/retention/status";

export type UserOperationalRow = {
  userId: string;
  email: string;
  name: string;
  signupAt: Date;
  betaCohort: BetaCohort | null;
  mealCount: number;
  lastMealAt: Date | null;
  feedbackCount: number;
  onboardingCompleted: boolean;
  retentionStatus: RetentionStatus;
  /** Admin-granted complimentary Pro access end (null when none). */
  complimentaryAccessUntil: Date | null;
};

export type OperationalListOptions = {
  q?: string;
  segment?: RetentionStatus | "all";
  limit?: number;
};

async function onboardingUserIds() {
  const rows = await db
    .selectDistinct({ userId: analyticsEvents.userId })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.name, [...ONBOARDING_ANALYTICS_EVENT_NAMES]),
        sql`${analyticsEvents.userId} is not null`
      )
    );

  return new Set(rows.map((row) => row.userId).filter(Boolean) as string[]);
}

export async function listOperationalUserRows(
  options: OperationalListOptions = {}
): Promise<UserOperationalRow[]> {
  const limit = options.limit ?? 500;
  const onboarded = await onboardingUserIds();

  // Raw SQL fields referenced from these subqueries in the outer select MUST
  // carry an explicit `.as(alias)` — otherwise Drizzle can't generate a stable
  // column reference and throws "raw SQL field … doesn't have an alias".
  const mealAgg = db
    .select({
      userId: mealLogs.cookedByUserId,
      mealCount: sql<number>`count(${mealLogs.id})::int`.as("meal_count"),
      lastMealAt: sql<Date | null>`max(${mealLogs.createdAt})`.as("last_meal_at")
    })
    .from(mealLogs)
    .groupBy(mealLogs.cookedByUserId)
    .as("meal_agg");

  const feedbackAgg = db
    .select({
      userId: betaFeedback.userId,
      feedbackCount: sql<number>`count(${betaFeedback.id})::int`.as("feedback_count")
    })
    .from(betaFeedback)
    .groupBy(betaFeedback.userId)
    .as("fb_agg");

  let query = db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      signupAt: users.createdAt,
      betaCohort: users.betaCohort,
      complimentaryAccessUntil: users.complimentaryAccessUntil,
      onboardingCompletedAt: users.onboardingCompletedAt,
      mealCount: sql<number>`coalesce(${mealAgg.mealCount}, 0)::int`,
      lastMealAt: mealAgg.lastMealAt,
      feedbackCount: sql<number>`coalesce(${feedbackAgg.feedbackCount}, 0)::int`
    })
    .from(users)
    .leftJoin(mealAgg, eq(users.id, mealAgg.userId))
    .leftJoin(feedbackAgg, eq(users.id, feedbackAgg.userId))
    .$dynamic();

  const filters = [];

  if (options.q?.trim()) {
    const pattern = `%${options.q.trim()}%`;
    filters.push(sql`lower(${users.email}) like lower(${pattern})`);
  }

  if (filters.length === 1) {
    query = query.where(filters[0]);
  } else if (filters.length > 1) {
    query = query.where(and(...filters));
  }

  const rows = await query.orderBy(sql`${users.createdAt} desc`).limit(limit);

  const mapped: UserOperationalRow[] = rows.map((row) => {
    const mealCount = Number(row.mealCount ?? 0);
    const lastMealAt = row.lastMealAt;

    const retentionStatus = computeRetentionStatus({
      signupAt: row.signupAt,
      mealCount,
      lastMealLogAt: lastMealAt
    });

    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      signupAt: row.signupAt,
      betaCohort: row.betaCohort ?? null,
      mealCount,
      lastMealAt,
      feedbackCount: Number(row.feedbackCount ?? 0),
      // Trust the column when set; fall back to historical analytics events
      // so users who completed onboarding before this column existed still
      // count as onboarded.
      onboardingCompleted: row.onboardingCompletedAt !== null || onboarded.has(row.userId),
      retentionStatus,
      complimentaryAccessUntil: row.complimentaryAccessUntil ?? null
    };
  });

  if (options.segment && options.segment !== "all") {
    return mapped.filter((row) => row.retentionStatus === options.segment);
  }

  return mapped;
}

export function summarizeRetentionBuckets(rows: UserOperationalRow[]) {
  const buckets: Record<RetentionStatus, number> = {
    new_user: 0,
    activated: 0,
    engaged: 0,
    at_risk: 0,
    inactive: 0
  };

  for (const row of rows) {
    buckets[row.retentionStatus] += 1;
  }

  return buckets;
}

export async function updateUserBetaCohort(userId: string, cohort: BetaCohort | null) {
  const [updated] = await db
    .update(users)
    .set({
      betaCohort: cohort,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return updated;
}
