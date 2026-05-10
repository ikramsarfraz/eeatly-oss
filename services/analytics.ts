import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  notExists,
  sql
} from "drizzle-orm";
import { ONBOARDING_ANALYTICS_EVENT_NAMES } from "@/lib/analytics/onboarding-events";
import { analyticsEvents, mealLogs, users } from "@/db/schema";
import { db } from "@/lib/db/client";
import type { AnalyticsEventName, AnalyticsMetadata } from "@/lib/observability/analytics";
import { listOperationalUserRows, summarizeRetentionBuckets } from "@/services/user-lifecycle";

type TrackAnalyticsEventInput = {
  name: AnalyticsEventName;
  userId?: string;
  metadata?: AnalyticsMetadata;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export async function createAnalyticsEvent(input: TrackAnalyticsEventInput) {
  await db.insert(analyticsEvents).values({
    userId: input.userId,
    name: input.name,
    metadata: input.metadata
  });
}

const onboardingEventNamesForInArray: AnalyticsEventName[] = [
  ...ONBOARDING_ANALYTICS_EVENT_NAMES
];

export async function getAdminAnalyticsSummary() {
  const today = startOfToday();
  const weekAgo = daysAgo(7);

  const [totalUsersRow] = await db.select({ value: count(users.id) }).from(users);
  const [mealsLoggedRow] = await db.select({ value: count(mealLogs.id) }).from(mealLogs);
  const [mealsLoggedTodayRow] = await db
    .select({ value: count(mealLogs.id) })
    .from(mealLogs)
    .where(gte(mealLogs.createdAt, today));

  const [onboardingCompletionsRow] = await db
    .select({ value: sql<number>`count(distinct ${analyticsEvents.userId})::int` })
    .from(analyticsEvents)
    .where(and(inArray(analyticsEvents.name, onboardingEventNamesForInArray), isNotNull(analyticsEvents.userId)));

  const [firstMealsUsersRow] = await db
    .select({ value: sql<number>`count(distinct ${mealLogs.userId})::int` })
    .from(mealLogs);

  const [secondMealsUsersRow] = await db
    .select({
      value: sql<number>`(
        SELECT COUNT(*)::int FROM (
          SELECT ${mealLogs.userId}
          FROM ${mealLogs}
          GROUP BY ${mealLogs.userId}
          HAVING COUNT(${mealLogs.id}) > 1
        ) repeat_log_users
      )`.mapWith(Number)
    })
    .from(users)
    .limit(1);

  const distinctRediscoveryUsersQuery = db
    .select({ value: sql<number>`count(distinct ${analyticsEvents.userId})::int` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.name, "rediscovery_clicked"), isNotNull(analyticsEvents.userId)));

  const [distinctRediscoveryUsersRow] = await distinctRediscoveryUsersQuery;

  const totalUserCount = Number(totalUsersRow?.value ?? 0);
  const mealCount = Number(mealsLoggedRow?.value ?? 0);
  const onboardingCount = Number(onboardingCompletionsRow?.value ?? 0);
  const firstMealUsers = Number(firstMealsUsersRow?.value ?? 0);
  const secondMealUsers = Number(secondMealsUsersRow?.value ?? 0);

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  const funnelPercents = {
    onboardingPct: pct(onboardingCount, totalUserCount),
    firstMealPct: pct(firstMealUsers, totalUserCount),
    secondMealPct: pct(secondMealUsers, Math.max(firstMealUsers, 1)),
    rediscoveryPct: pct(Number(distinctRediscoveryUsersRow?.value ?? 0), totalUserCount)
  };

  const commonEvents = await db
    .select({
      name: analyticsEvents.name,
      count: count(analyticsEvents.id)
    })
    .from(analyticsEvents)
    .groupBy(analyticsEvents.name)
    .orderBy(desc(count(analyticsEvents.id)));

  const recentEvents = await db
    .select({
      id: analyticsEvents.id,
      name: analyticsEvents.name,
      metadata: analyticsEvents.metadata,
      createdAt: analyticsEvents.createdAt,
      userEmail: users.email
    })
    .from(analyticsEvents)
    .leftJoin(users, eq(analyticsEvents.userId, users.id))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(50);

  const [dailyActiveUsersRow] = await db
    .select({ value: sql<number>`count(distinct ${analyticsEvents.userId})::int` })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, today), isNotNull(analyticsEvents.userId)));

  const [weeklyActiveUsersRow] = await db
    .select({ value: sql<number>`count(distinct ${analyticsEvents.userId})::int` })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, weekAgo), isNotNull(analyticsEvents.userId)));

  const [returningUsersRow] = await db
    .select({
      value: sql<number>`(
        SELECT COUNT(*)::int FROM (
          SELECT ${analyticsEvents.userId}
          FROM ${analyticsEvents}
          WHERE ${analyticsEvents.userId} IS NOT NULL
          GROUP BY ${analyticsEvents.userId}
          HAVING COUNT(${analyticsEvents.id}) > 1
        ) returning_users_events
      )`.mapWith(Number)
    })
    .from(users)
    .limit(1);

  const [repeatLogAgainRow] = await db
    .select({
      distinctUsers: sql<number>`count(distinct ${analyticsEvents.userId})::int`,
      events: sql<number>`count(*)::int`
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.name, "meal_logged_again"), isNotNull(analyticsEvents.userId)));

  const [usersWithThreePlusRow] = await db
    .select({
      value: sql<number>`(
        SELECT COUNT(*)::int FROM (
          SELECT ${mealLogs.userId}
          FROM ${mealLogs}
          GROUP BY ${mealLogs.userId}
          HAVING COUNT(${mealLogs.id}) >= 3
        ) heavy_loggers
      )`.mapWith(Number)
    })
    .from(users)
    .limit(1);

  const usersNoMealsSubquery = db
    .select({ id: mealLogs.id })
    .from(mealLogs)
    .where(eq(mealLogs.userId, users.id))
    .limit(1);

  const [usersNoMealsRow] = await db
    .select({ value: count(users.id) })
    .from(users)
    .where(notExists(usersNoMealsSubquery));

  const [weeklyMealUsersRow] = await db
    .select({ value: sql<number>`count(distinct ${mealLogs.userId})::int` })
    .from(mealLogs)
    .where(gte(mealLogs.createdAt, weekAgo));

  const [todayMealUsersRow] = await db
    .select({ value: sql<number>`count(distinct ${mealLogs.userId})::int` })
    .from(mealLogs)
    .where(gte(mealLogs.createdAt, today));

  const weeklyMealUsers = Number(weeklyMealUsersRow?.value ?? 0);
  const todayMealUsers = Number(todayMealUsersRow?.value ?? 0);
  const activeLastWeekNotTodayViaMeals =
    weeklyMealUsers > 0 ? Math.max(weeklyMealUsers - todayMealUsers, 0) : 0;

  let avgHoursBetweenLogs: number | null = null;
  try {
    const gapRows = await db.execute<{ avg_hours: string | number | null }>(
      sql`WITH deltas AS (
        SELECT EXTRACT(EPOCH FROM (created_at - lag_created)) / 3600.0 AS gap_hours
        FROM (
          SELECT
            created_at,
            lag(created_at) OVER (
              PARTITION BY user_id
              ORDER BY created_at
            ) AS lag_created
          FROM ${mealLogs}
        ) gaps
        WHERE lag_created IS NOT NULL
      )
      SELECT AVG(gap_hours) AS avg_hours FROM deltas`
    );

    type ExecuteRow = { rows?: { avg_hours: string | number | null }[] };
    type ExecuteArray = { avg_hours: string | number | null }[];
    const firstGap =
      (gapRows as ExecuteRow)?.rows?.[0] ??
      (Array.isArray(gapRows) ? (gapRows as unknown as ExecuteArray)[0] : undefined);

    const raw = firstGap?.avg_hours;
    if (raw !== null && raw !== undefined && String(raw).length > 0) {
      avgHoursBetweenLogs = Number(raw);
      if (!Number.isFinite(avgHoursBetweenLogs)) {
        avgHoursBetweenLogs = null;
      }
    }
  } catch {
    avgHoursBetweenLogs = null;
  }

  const rediscoveryReasonRows = await db
    .select({
      reason: sql<string>`coalesce(${analyticsEvents.metadata} ->> 'reason', '(unknown)')`,
      count: count(analyticsEvents.id)
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.name, "rediscovery_clicked"), isNotNull(analyticsEvents.metadata)))
    .groupBy(sql`coalesce(${analyticsEvents.metadata} ->> 'reason', '(unknown)')`)
    .orderBy(desc(count(analyticsEvents.id)));

  const effortDistribution = await db
    .select({
      effortLevel: mealLogs.effortLevel,
      logCount: count(mealLogs.id)
    })
    .from(mealLogs)
    .groupBy(mealLogs.effortLevel)
    .orderBy(desc(count(mealLogs.id)));

  let dayOneRetentionPct = 0;
  let daySevenRetentionPct = 0;

  try {
    const retentionRows = await db.execute<{
      d1_eligible: number;
      d1_retained: number;
      d7_eligible: number;
      d7_retained: number;
    }>(
      sql`WITH cohort AS (
        SELECT ${users.id}, (${users.createdAt})::date AS signup_day FROM ${users}
        WHERE (${users.createdAt})::date <= CURRENT_DATE - INTERVAL '2 day'
      ),
      d1_eligible AS (SELECT COUNT(*)::int AS c FROM cohort),
      d1_retained AS (
        SELECT COUNT(DISTINCT cohort.id)::int AS c
        FROM cohort
        INNER JOIN ${mealLogs} ml ON ml.user_id = cohort.id AND (ml.created_at)::date = cohort.signup_day + 1
      ),
      cohort7 AS (
        SELECT ${users.id}, (${users.createdAt})::date AS signup_day FROM ${users}
        WHERE (${users.createdAt})::date <= CURRENT_DATE - INTERVAL '8 day'
      ),
      d7_eligible AS (SELECT COUNT(*)::int AS c FROM cohort7),
      d7_retained AS (
        SELECT COUNT(DISTINCT cohort7.id)::int AS c FROM cohort7
        INNER JOIN ${mealLogs} ml ON ml.user_id = cohort7.id
        WHERE (ml.created_at)::date - cohort7.signup_day >= 7
      )
      SELECT (SELECT c FROM d1_eligible) AS d1_eligible,
        (SELECT c FROM d1_retained) AS d1_retained,
        (SELECT c FROM d7_eligible) AS d7_eligible,
        (SELECT c FROM d7_retained) AS d7_retained`
    );

    type RetRow = {
      d1_eligible?: number;
      d1_retained?: number;
      d7_eligible?: number;
      d7_retained?: number;
    };
    type RetExecute = { rows?: RetRow[] };
    const r =
      (retentionRows as RetExecute)?.rows?.[0] ??
      (Array.isArray(retentionRows) ? (retentionRows as unknown as RetRow[])[0] : undefined);

    if (r?.d1_eligible && Number(r.d1_eligible) > 0) {
      dayOneRetentionPct = Math.round(((Number(r.d1_retained) || 0) / Number(r.d1_eligible)) * 100);
    }
    if (r?.d7_eligible && Number(r.d7_eligible) > 0) {
      daySevenRetentionPct = Math.round(((Number(r.d7_retained) || 0) / Number(r.d7_eligible)) * 100);
    }
  } catch {
    dayOneRetentionPct = 0;
    daySevenRetentionPct = 0;
  }

  const onboardingCompletionRate = funnelPercents.onboardingPct;

  const operationalRows = await listOperationalUserRows({ limit: 5000 });
  const retentionBuckets = summarizeRetentionBuckets(operationalRows);

  return {
    totals: {
      users: totalUserCount,
      mealsLogged: mealCount,
      mealsLoggedToday: Number(mealsLoggedTodayRow?.value ?? 0),
      onboardingCompletions: onboardingCount,
      dailyActiveUsers: Number(dailyActiveUsersRow?.value ?? 0),
      weeklyActiveUsers: Number(weeklyActiveUsersRow?.value ?? 0),
      returningUsers: Number(returningUsersRow?.value ?? 0),
      avgMealsPerUser: totalUserCount > 0 ? mealCount / totalUserCount : 0,
      onboardingCompletionRate,
      firstMealsUsers: firstMealUsers,
      secondMealsUsers: secondMealUsers,
      rediscoveryDistinctUsers: Number(distinctRediscoveryUsersRow?.value ?? 0),
      onboardingCompletionPct: onboardingCompletionRate,
      firstMealConversionPct: funnelPercents.firstMealPct,
      secondMealConversionPct: funnelPercents.secondMealPct,
      rediscoveryEngagementPct: funnelPercents.rediscoveryPct,
      dayOneRetentionPct,
      daySevenRetentionPct,
      usersWithThreePlusMeals: Number(usersWithThreePlusRow?.value ?? 0),
      repeatLogAgainUsers: Number(repeatLogAgainRow?.distinctUsers ?? 0),
      repeatLogAgainEvents: Number(repeatLogAgainRow?.events ?? 0),
      usersWithNoMeals: Number(usersNoMealsRow?.value ?? 0),
      avgHoursBetweenLogs,
      activeLastWeekNotTodayViaMeals,
      insightEffortBars: effortDistribution.map((row) => ({
        name: String(row.effortLevel ?? "").replaceAll("_", " ") || "(unknown)",
        count: Number(row.logCount ?? 0)
      })),
      insightRediscoveryReasons: rediscoveryReasonRows.map((row) => ({
        name: row.reason || "(unknown)",
        count: Number(row.count ?? 0)
      }))
    },
    funnel: funnelPercents,
    retentionBuckets,
    commonEvents: commonEvents.map((event) => ({
      name: event.name,
      count: Number(event.count)
    })),
    recentEvents
  };
}
