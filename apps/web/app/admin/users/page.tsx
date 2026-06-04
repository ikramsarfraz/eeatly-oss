import { format } from "date-fns";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCohortPicker,
  UserLifecycleEmailButtons
} from "@/components/admin/user-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  RETENTION_STATUS_LABELS,
  parseSegmentFilter,
  type RetentionStatus
} from "@/lib/retention/status";
import { cn } from "@/lib/utils";
import { listOperationalUserRows } from "@/services/user-lifecycle";

function segmentHref(segment: RetentionStatus | "all") {
  if (segment === "all") {
    return "/admin/users";
  }

  const param = segment === "new_user" ? "new" : segment === "at_risk" ? "at-risk" : segment;

  return `/admin/users?segment=${param}`;
}

function retentionBadgePresentation(status: RetentionStatus): {
  variant: NonNullable<BadgeProps["variant"]>;
  className?: string;
} {
  switch (status) {
    case "engaged":
      return { variant: "warm" };
    case "activated":
      return { variant: "secondary" };
    case "new_user":
      return { variant: "outline" };
    case "at_risk":
      return {
        variant: "outline",
        className:
          "border-amber-500/70 text-amber-950 dark:border-amber-600/60 dark:text-amber-200"
      };
    default:
      return {
        variant: "outline",
        className:
          "border-destructive/60 bg-destructive/10 text-destructive"
      };
  }
}

type PageProps = {
  searchParams?: Promise<{ q?: string; segment?: string }> | { q?: string; segment?: string };
};

export default async function AdminUsersPage(props: PageProps) {
  await requirePlatformAdmin();

  const sp = await Promise.resolve(props.searchParams ?? {});
  const q = typeof sp.q === "string" ? sp.q : "";
  const segment = parseSegmentFilter(sp.segment);

  const rows = await listOperationalUserRows({
    q: q || undefined,
    segment,
    limit: 800
  });

  const filters: { label: string; segment: RetentionStatus | "all" }[] = [
    { label: "All people", segment: "all" },
    { label: "New", segment: "new_user" },
    { label: "Activated", segment: "activated" },
    { label: "Engaged", segment: "engaged" },
    { label: "At risk", segment: "at_risk" },
    { label: "Inactive", segment: "inactive" }
  ];

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Platform admin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Beta user operations</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Roster filters for cohort DMs plus manual transactional emails until scheduling arrives.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Segment</span>
        {filters.map((item) => (
          <Button
            key={item.segment}
            asChild
            size="sm"
            variant={segment === item.segment ? "secondary" : "outline"}
          >
            <a href={segmentHref(item.segment)}>{item.label}</a>
          </Button>
        ))}
      </div>

      <form className="flex flex-wrap gap-3" action="/admin/users" method="get">
        {sp.segment ? <input name="segment" type="hidden" value={String(sp.segment)} /> : null}
        <label className="grid gap-1 text-xs text-muted-foreground">
          Search email
          <input
            className={cn(
              "h-10 w-full min-w-[220px] rounded-md border bg-background px-3 text-sm",
              "text-foreground"
            )}
            defaultValue={q}
            name="q"
            placeholder="name@domain"
            type="search"
          />
        </label>
        <Button className="self-end" size="sm" type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Cohort</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Signup</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Meals</TableHead>
              <TableHead>Last meal</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead>Retention</TableHead>
              <TableHead className="min-w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="text-sm text-muted-foreground" colSpan={9}>
                  No users matched this slice.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => {
              const badge = retentionBadgePresentation(row.retentionStatus);
              return (
                <TableRow key={row.userId}>
                <TableCell className="align-top">
                  <UserCohortPicker userId={row.userId} currentCohort={row.betaCohort} />
                </TableCell>
                <TableCell className="align-top font-medium">
                  <div>{row.email}</div>
                  <div className="text-xs font-normal text-muted-foreground">{row.name}</div>
                </TableCell>
                <TableCell>{format(row.signupAt, "MMM d, yyyy")}</TableCell>
                <TableCell>
                  {row.onboardingCompleted ? (
                    <Badge variant="secondary">Complete</Badge>
                  ) : (
                    <Badge variant="outline">Open</Badge>
                  )}
                </TableCell>
                <TableCell>{row.mealCount}</TableCell>
                <TableCell>
                  {row.lastMealAt ? format(row.lastMealAt, "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell>{row.feedbackCount}</TableCell>
                <TableCell>
                  <Badge className={badge.className} variant={badge.variant}>
                    {RETENTION_STATUS_LABELS[row.retentionStatus]}
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-xs">
                  <UserLifecycleEmailButtons userId={row.userId} />
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
      <p className="text-xs text-muted-foreground">
        Each send emits <code className="text-[11px]">reminder_email_sent</code> with a metadata template id;
        stubs mirror future ESP webhooks without leaving eeatly infra.
      </p>
    </main>
  );
}
