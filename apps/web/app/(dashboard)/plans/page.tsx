import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { listPlansForHousehold } from "@/services/plans";
import { PlansClient } from "@/components/plans/plans-client";

export const metadata: Metadata = {
  title: "Plans"
};

export const dynamic = "force-dynamic";

/**
 * Round 28 — Plans list. Server shell.
 *
 * Includes archived plans in the response so the Drafts section in
 * the client can split them out client-side. The R23 `?archived=1`
 * toggle is gone — the new layout surfaces archived plans inline as
 * "Drafts & ideas" rather than behind a toggle.
 */
export default async function PlansPage() {
  const { user, household } = await requireCurrentUserWithHousehold();

  const plans = await listPlansForHousehold({
    householdId: household.id,
    userId: user.id,
    includeArchived: true
  });

  return (
    <PlansClient
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        scheduledDate: p.scheduledDate,
        archivedAt: p.archivedAt,
        dishCount: p.dishCount
      }))}
    />
  );
}
