import { eq } from "drizzle-orm";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { getCurrentHousehold, requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { countHouseholdMembers } from "@/services/households";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();

  // Gate the dashboard on completed onboarding so the multi-step flow runs
  // exactly once per user. The /onboarding route does the inverse check
  // (redirects back here if completion is already stamped) so the two
  // surfaces can't fight each other.
  const row = await db
    .select({ onboardingCompletedAt: users.onboardingCompletedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row[0]?.onboardingCompletedAt) {
    redirect("/onboarding" as Route);
  }

  // Subtle household indicator. Only surface it when the household has more
  // than one member — solo cooks don't need to know they're "in a kitchen."
  // The lookup is cheap and cached via `getCurrentHousehold` (React cache).
  const household = await getCurrentHousehold(user.id);
  const memberCount = await countHouseholdMembers(household.id);
  const householdLabel = memberCount > 1 ? household.name : null;

  return (
    <QueryProvider>
      <ToastProvider>
        <AppShell user={user} householdLabel={householdLabel}>
          {children}
        </AppShell>
      </ToastProvider>
    </QueryProvider>
  );
}
