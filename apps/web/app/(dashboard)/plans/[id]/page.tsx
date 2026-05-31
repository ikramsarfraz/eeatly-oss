import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import {
  getPlan,
  listMealLibrary
} from "@/services/plans";
import { listHouseholdMembers } from "@/services/households";
import { PlanDetailClient } from "@/components/plans/plan-detail-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plan"
};

/**
 * Round 28 — Plan Detail. Server shell.
 *
 * Fetches the plan + meal library + household members in parallel.
 * Members back the new "Cooks invited" card. The R23 effort-aggregate
 * and clone-hint fetches are dropped — the editorial layout doesn't
 * surface them, and adding them back later is a one-line addition
 * once the visual lands.
 *
 * Auth gate: `getPlan` throws when the user isn't a household member.
 * Both "not found" and "not authorized" surface as 404 (same as R23)
 * so existence info doesn't leak.
 */
export default async function PlanDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { user, household } = await requireCurrentUserWithHousehold();
  const { id } = await props.params;

  let plan;
  try {
    plan = await getPlan({ planId: id, userId: user.id });
  } catch {
    notFound();
  }

  const [library, members] = await Promise.all([
    listMealLibrary({ userId: user.id, householdId: household.id }),
    listHouseholdMembers(user.id, household.id)
  ]);

  return (
    <PlanDetailClient
      plan={{
        id: plan.id,
        name: plan.name,
        scheduledDate: plan.scheduledDate,
        notes: plan.notes,
        archivedAt: plan.archivedAt
      }}
      isOwner={plan.createdByUserId === user.id}
      ownerName={plan.ownerName}
      dishes={plan.dishes.map((d) => ({
        id: d.id,
        mealId: d.mealId,
        mealName: d.mealName,
        mealPhotoUrl: d.mealPhotoUrl,
        sortOrder: d.sortOrder,
        actualEffort: d.actualEffort,
        timeTakenMinutes: d.timeTakenMinutes,
        verdict: d.verdict,
        annotationNotes: d.annotationNotes,
        locked: d.locked
      }))}
      hiddenDishCount={plan.hiddenDishCount}
      members={members.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: m.role
      }))}
      library={library.map((r) => ({
        id: r.id,
        name: r.name,
        photoUrl: r.photoUrl
      }))}
    />
  );
}
