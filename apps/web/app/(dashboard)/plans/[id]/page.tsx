import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { logger } from "@/lib/observability/logger";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import {
  getPlan,
  getPlanAnnotationsByMealId,
  getPlanEffortAggregate,
  listMealLibrary,
  type PreviousAnnotationsMap
} from "@/services/plans";
import { PlanDetail } from "@/components/plans/plan-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plan"
};

export default async function PlanDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hintsFrom?: string }>;
}) {
  const { user, household } = await requireCurrentUserWithHousehold();
  const { id } = await props.params;
  const sp = await props.searchParams;

  // getPlan throws "Plan not found" when the row doesn't exist OR when the
  // caller isn't a member of the plan's household. Both surface as 404 to
  // avoid leaking existence info to non-members.
  let plan;
  try {
    plan = await getPlan({ planId: id, userId: user.id });
  } catch {
    notFound();
  }

  // Library + aggregate run in parallel — both gated by their own
  // requireHouseholdMember check via React `cache()`, so the three
  // sequential awaits collapse to one DB membership lookup.
  const [library, effortAggregate] = await Promise.all([
    listMealLibrary({ userId: user.id, householdId: household.id }),
    getPlanEffortAggregate({ planId: id, userId: user.id })
  ]);

  // Optional `?hintsFrom=<sourcePlanId>` survives refresh / direct links.
  // If the user isn't a member of the source plan's household, the service
  // throws and we silently swallow — hints are advisory, not load-bearing,
  // and surfacing a 404 here would block the legitimate new-plan view.
  let hints: PreviousAnnotationsMap | undefined;
  if (sp.hintsFrom) {
    try {
      hints = await getPlanAnnotationsByMealId({
        planId: sp.hintsFrom,
        userId: user.id
      });
    } catch (error) {
      logger.info("plan_hints_fetch_skipped", {
        userId: user.id,
        sourcePlanId: sp.hintsFrom,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return (
    <PlanDetail
      plan={{
        id: plan.id,
        name: plan.name,
        scheduledDate: plan.scheduledDate,
        notes: plan.notes,
        archivedAt: plan.archivedAt
      }}
      dishes={plan.dishes.map((d) => ({
        id: d.id,
        mealId: d.mealId,
        mealName: d.mealName,
        mealPhotoUrl: d.mealPhotoUrl,
        sortOrder: d.sortOrder,
        actualEffort: d.actualEffort,
        timeTakenMinutes: d.timeTakenMinutes,
        verdict: d.verdict,
        annotationNotes: d.annotationNotes
      }))}
      library={library}
      hints={hints}
      effortAggregate={effortAggregate}
    />
  );
}
