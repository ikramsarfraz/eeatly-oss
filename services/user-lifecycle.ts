import "server-only";

import { eq, and, count, lte, gte, inArray, notExists, sql } from "drizzle-orm";
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
};

export type OperationalListOptions = {
  q?: string;
  segment?: RetentionStatus | "all";
  limit?: number;
};

const daysAgoDate = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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

  const mealAgg = db
    .select({
      userId: mealLogs.userId,
      mealCount: sql<number>`count(${mealLogs.id})::int`,
      lastMealAt: sql<Date | null>`max(${mealLogs.createdAt})`
    })
    .from(mealLogs)
    .groupBy(mealLogs.userId)
    .as("meal_agg");

  const feedbackAgg = db
    .select({
      userId: betaFeedback.userId,
      feedbackCount: sql<number>`count(${betaFeedback.id})::int`
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
      retentionStatus
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

export async function queryUsersZeroMealsAfterSignupDays(daysSinceSignup: number) {
  const cutoff = daysAgoDate(daysSinceSignup);

  return db
    .select({
      userId: users.id,
      email: users.email,
      createdAt: users.createdAt
    })
    .from(users)
    .where(
      and(
        lte(users.createdAt, cutoff),
        notExists(
          db.select({ _: sql`1` }).from(mealLogs).where(eq(mealLogs.userId, users.id))
        )
      )
    );
}

export async function queryUsersInactiveWithMealsForDays(minDays: number) {
  const cutoff = daysAgoDate(minDays);

  const mealAgg = db
    .select({
      userId: mealLogs.userId,
      mealCount: sql<number>`count(*)::int`,
      lastMealAt: sql<Date>`max(${mealLogs.createdAt})`
    })
    .from(mealLogs)
    .groupBy(mealLogs.userId)
    .as("meal_agg");

  return db
    .select({
      userId: users.id,
      email: users.email,
      mealCount: mealAgg.mealCount,
      lastMealAt: mealAgg.lastMealAt
    })
    .from(users)
    .innerJoin(mealAgg, eq(users.id, mealAgg.userId))
    .where(and(gte(mealAgg.mealCount, 1), lte(mealAgg.lastMealAt, cutoff)));
}

export async function queryUsersWithExactlyOneMeal() {
  const once = db
    .select({
      userId: mealLogs.userId,
      mealCount: sql<number>`count(${mealLogs.id})::int`
    })
    .from(mealLogs)
    .groupBy(mealLogs.userId)
    .having(eq(count(mealLogs.id), 1))
    .as("once");

  return db
    .select({
      userId: users.id,
      email: users.email,
      mealCount: once.mealCount
    })
    .from(users)
    .innerJoin(once, eq(users.id, once.userId));
}

export async function queryHighlyEngagedUsers(minMeals = 5, activeWithinDays = 14) {
  const activeCutoff = daysAgoDate(activeWithinDays);

  const engaged = db
    .select({
      userId: mealLogs.userId,
      mealCount: sql<number>`count(*)::int`,
      lastMealAt: sql<Date>`max(${mealLogs.createdAt})`
    })
    .from(mealLogs)
    .groupBy(mealLogs.userId)
    .as("engaged");

  return db
    .select({
      userId: users.id,
      email: users.email,
      mealCount: engaged.mealCount,
      lastMealAt: engaged.lastMealAt
    })
    .from(users)
    .innerJoin(engaged, eq(users.id, engaged.userId))
    .where(
      and(
        gte(engaged.mealCount, minMeals),
        gte(engaged.lastMealAt, activeCutoff)
      )
    );
}

export async function queryRecentlyActivatedUsers(firstMealWithinDays = 3) {
  const cutoff = daysAgoDate(firstMealWithinDays);

  const firstLog = db
    .select({
      userId: mealLogs.userId,
      firstAt: sql<Date>`min(${mealLogs.createdAt})`
    })
    .from(mealLogs)
    .groupBy(mealLogs.userId)
    .as("first_log");

  return db
    .select({
      userId: users.id,
      email: users.email,
      firstMealAt: firstLog.firstAt
    })
    .from(users)
    .innerJoin(firstLog, eq(users.id, firstLog.userId))
    .where(gte(firstLog.firstAt, cutoff));
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
