import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { listPlansForHousehold } from "@/services/plans";
import { PlansList } from "@/components/plans/plans-list";

export const metadata: Metadata = {
  title: "Plans"
};

export const dynamic = "force-dynamic";

export default async function PlansPage(props: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { user, household } = await requireCurrentUserWithHousehold();
  const sp = await props.searchParams;
  const showingArchived = sp.archived === "1";

  const plans = await listPlansForHousehold({
    householdId: household.id,
    userId: user.id,
    includeArchived: showingArchived
  });

  return (
    <PlansList
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        scheduledDate: p.scheduledDate,
        archivedAt: p.archivedAt,
        dishCount: p.dishCount
      }))}
      showingArchived={showingArchived}
    />
  );
}
