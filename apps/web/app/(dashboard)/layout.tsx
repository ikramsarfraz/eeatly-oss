import { eq } from "drizzle-orm";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentHousehold, requireCurrentUser } from "@/lib/auth/session";
import { db, withRlsContext } from "@/lib/db/client";
import { countHouseholdMembers } from "@/services/households";
import { noIndexMetadata } from "@/lib/seo/no-index";

export const dynamic = "force-dynamic";

// The authenticated product is private — keep it out of every index.
export const metadata = noIndexMetadata;

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();

  // All DB reads run inside the RLS scope (user resolution above is on the
  // privileged auth path). Compute the onboarding flag + household label here;
  // redirect outside the scope so the transaction closes cleanly.
  const { onboardingCompletedAt, householdLabel } = await withRlsContext(
    user.id,
    async () => {
      // Gate the dashboard on completed onboarding so the multi-step flow runs
      // exactly once per user. The /onboarding route does the inverse check so
      // the two surfaces can't fight each other.
      const row = await db
        .select({ onboardingCompletedAt: users.onboardingCompletedAt })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const onboardingCompletedAt = row[0]?.onboardingCompletedAt ?? null;
      if (!onboardingCompletedAt) {
        return { onboardingCompletedAt: null, householdLabel: null };
      }
      // Subtle household indicator. Only surface it when the household has more
      // than one member — solo cooks don't need to know they're "in a kitchen."
      const household = await getCurrentHousehold(user.id);
      const memberCount = await countHouseholdMembers(user.id, household.id);
      return {
        onboardingCompletedAt,
        householdLabel: memberCount > 1 ? household.name : null
      };
    }
  );

  if (!onboardingCompletedAt) {
    redirect("/onboarding" as Route);
  }

  return (
    <AppShell user={user} householdLabel={householdLabel}>
      {children}
    </AppShell>
  );
}
