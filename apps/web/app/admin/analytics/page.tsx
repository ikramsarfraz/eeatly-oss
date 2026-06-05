import { format } from "date-fns";
import { Activity, ArrowRightLeft, BarChart3, Layers, Target } from "lucide-react";
import { ActivationFunnelBars, formatGapHours } from "@/components/admin/activation-funnel-bars";
import { EventBarChart } from "@/components/admin/event-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { RETENTION_STATUS_LABELS, type RetentionStatus } from "@/lib/retention/status";
import { getAdminAnalyticsSummary } from "@/services/analytics";

const retentionOrder: RetentionStatus[] = [
  "new_user",
  "activated",
  "engaged",
  "at_risk",
  "inactive"
];

const eventLabels: Record<string, string> = {
  signed_up: "Signed up",
  signed_in: "Signed in",
  completed_onboarding: "Onboarding complete",
  onboarding_completed: "Onboarding legacy",
  first_meal_logged: "First meal",
  second_meal_logged: "Second meal",
  meal_logged: "Meal logged",
  meal_logged_again: "Log again flow",
  feedback_submitted: "Feedback submitted",
  rediscovery_clicked: "Rediscovery tapped",
  reminder_email_sent: "Lifecycle email sent",
  reminder_email_open_placeholder: "Lifecycle open stub",
  reminder_email_clicked_placeholder: "Lifecycle click stub",
  email_sent: "Email sent (delivery)",
  email_delivered: "Email delivered",
  email_opened: "Email opened",
  email_clicked: "Email link clicked",
  email_bounced: "Email bounced",
  email_complained: "Spam complaint",
  email_delivery_failed: "Email delivery failed / suppressed"
};

function formatReasonLabel(reason: string) {
  switch (reason) {
    case "favorite":
      return "Neglected favorite";
    case "neglected":
      return "Long idle window";
    case "quick":
      return "Quick win";
    case "frequent":
      return "Repeats";
    default:
      return reason;
  }
}

export default async function AdminAnalyticsPage() {
  await requirePlatformAdmin();
  const analytics = await getAdminAnalyticsSummary();

  const healthCards = [
    ["Total users", analytics.totals.users.toString()],
    ["Meals logged", analytics.totals.mealsLogged.toString()],
    ["Meals today", analytics.totals.mealsLoggedToday.toString()],
    ["DAU (events)", analytics.totals.dailyActiveUsers.toString()],
    ["WAU (events)", analytics.totals.weeklyActiveUsers.toString()],
    ["Avg meals/user", analytics.totals.avgMealsPerUser.toFixed(1)]
  ] as const;

  const funnelCards = [
    ["Onboarding (events)", analytics.totals.onboardingCompletions.toString()],
    ["First meal cohort", analytics.totals.firstMealsUsers.toString()],
    ["Multi-log cooks", analytics.totals.secondMealsUsers.toString()],
    ["Rediscovery users", analytics.totals.rediscoveryDistinctUsers.toString()]
  ] as const;

  const cohortCards = [
    ["Day-1 cohort retention", `${analytics.totals.dayOneRetentionPct}%`],
    ["Day-7+ return cohort", `${analytics.totals.daySevenRetentionPct}%`],
    ["Users · 3+ logs", analytics.totals.usersWithThreePlusMeals.toString()],
    ["Log-again cooks", analytics.totals.repeatLogAgainUsers.toString()],
    ["Log-again events", analytics.totals.repeatLogAgainEvents.toString()]
  ] as const;

  const frictionCards = [
    ["Avg gap between logs", formatGapHours(analytics.totals.avgHoursBetweenLogs)],
    ["No meals after signup", analytics.totals.usersWithNoMeals.toString()],
    ["Active last 7 days, not today (meals)", analytics.totals.activeLastWeekNotTodayViaMeals.toString()],
    ["Returning users (analytics)", analytics.totals.returningUsers.toString()]
  ] as const;

  const chartData = analytics.commonEvents.map((event) => ({
    name: eventLabels[event.name] ?? event.name,
    count: event.count
  }));

  const effortChart = analytics.totals.insightEffortBars.map((row) => ({
    name: row.name,
    count: row.count
  }));

  const rediscoveryChart = analytics.totals.insightRediscoveryReasons.map((row) => ({
    name: formatReasonLabel(row.name),
    count: row.count
  }));

  const signupPlatformChart = analytics.totals.signupPlatformBars.map((row) => ({
    name: row.name,
    count: row.count
  }));

  return (
    <main id="main" tabIndex={-1} className="grid w-full gap-6 px-5 py-5">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Platform admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Beta activation & retention</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Privacy-first aggregates for weekly beta reviews: onboarding progress, meals, repeat usage,
          and lightweight retention slices (query-driven cohorts vs full analytics tooling).
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {healthCards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Computed retention statuses</CardTitle>
          <p className="text-xs text-muted-foreground">
            Mirrors the labeling rules on `/admin/users` — meal recency drives the verdict.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {retentionOrder.map((key) => (
            <div key={key} className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{RETENTION_STATUS_LABELS[key]}</p>
              <p className="mt-2 text-xl font-semibold">{analytics.retentionBuckets[key]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Activation funnel
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Denominators emphasize total Better Auth accounts. Second meal divides by anyone with a first
            log.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {funnelCards.map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </section>
          <ActivationFunnelBars funnel={analytics.funnel} />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-primary" />
              Retention & repeat usage helper metrics
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Meal-log-derived cohort snapshots + repeat logging via internal events.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {cohortCards.map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Operational friction proxies
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Helps spot stalled accounts versus weekly momentum without heavyweight BI.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {frictionCards.map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-lg font-semibold leading-snug">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Event popularity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <EventBarChart data={chartData} />
          ) : (
            <div className="rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
              No analytics events recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Top effort selections</CardTitle>
            <p className="text-xs text-muted-foreground">Based on persisted meal_logs (not previews).</p>
          </CardHeader>
          <CardContent>
            {effortChart.length ? (
              <EventBarChart data={effortChart} heightClass="h-64" />
            ) : (
              <div className="rounded-lg border border-dashed bg-background/60 p-4 text-xs text-muted-foreground">
                No effort data logged yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Rediscovery reason taps</CardTitle>
            <p className="text-xs text-muted-foreground">Reason metadata from Useful idea confirmations.</p>
          </CardHeader>
          <CardContent>
            {rediscoveryChart.length ? (
              <EventBarChart data={rediscoveryChart} heightClass="h-64" />
            ) : (
              <div className="rounded-lg border border-dashed bg-background/60 p-4 text-xs text-muted-foreground">
                No rediscovery confirmations yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Signups by platform</CardTitle>
            <p className="text-xs text-muted-foreground">
              Web vs mobile, stamped at account creation. Signups before tracking show as Unknown.
            </p>
          </CardHeader>
          <CardContent>
            {signupPlatformChart.length ? (
              <EventBarChart data={signupPlatformChart} heightClass="h-64" />
            ) : (
              <div className="rounded-lg border border-dashed bg-background/60 p-4 text-xs text-muted-foreground">
                No signups recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Recent events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.recentEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
              No recent events.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Metadata</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">
                      {event.userEmail ?? "Anonymous"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {eventLabels[event.name] ?? event.name}
                    </TableCell>
                    <TableCell className="max-w-xl text-muted-foreground">
                      <code className="line-clamp-2 text-xs">
                        {event.metadata ? JSON.stringify(event.metadata) : "{}"}
                      </code>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(event.createdAt, "MMM d, yyyy h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
