import type { Metadata } from "next";
import { IdeasClient } from "@/components/dashboard/ideas-client";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getDashboardMeals } from "@/services/meals";

export const metadata: Metadata = {
  title: "Ideas",
  description: "Meals worth resurfacing tonight."
};

export default async function IdeasPage() {
  // Round 11: direct service call from a server component (see
  // dashboard/page.tsx for the rationale).
  // Lift the dashboard's teaser cap (4) so the dedicated Ideas page surfaces
  // the long tail of rediscovery candidates.
  const { user, household } = await requireCurrentUserWithHousehold();
  const meals = await getDashboardMeals(user.id, household.id, {
    suggestionLimit: 24
  });
  return <IdeasClient initialData={meals} />;
}
