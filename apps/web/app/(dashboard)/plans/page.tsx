import type { Metadata } from "next";
import { loadHousehold } from "@/lib/auth/rls";
import { listPlansForHousehold } from "@/services/plans";
import { PlansClient } from "@/components/plans/plans-client";
import { PlansMobile } from "@/components/mobile/plans-mobile";

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
  const plans = await loadHousehold(({ user, household }) =>
    listPlansForHousehold({
      householdId: household.id,
      userId: user.id,
      includeArchived: true
    })
  );

  const planItems = plans.map((p) => ({
    id: p.id,
    name: p.name,
    scheduledDate: p.scheduledDate,
    archivedAt: p.archivedAt,
    dishCount: p.dishCount
  }));

  return (
    <>
      <PlansMobile plans={planItems} />
      <div className="hidden md:block">
        <PlansClient plans={planItems} />
      </div>
    </>
  );
}
