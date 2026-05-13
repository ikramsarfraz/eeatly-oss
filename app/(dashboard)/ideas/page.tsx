import type { Metadata } from "next";
import { getDashboardMealsAction } from "@/actions/meals";
import { IdeasClient } from "@/components/dashboard/ideas-client";

export const metadata: Metadata = {
  title: "Ideas",
  description: "Meals worth resurfacing tonight."
};

export default async function IdeasPage() {
  // Lift the dashboard's teaser cap (4) so the dedicated Ideas page surfaces
  // the long tail of rediscovery candidates.
  const meals = await getDashboardMealsAction({ suggestionLimit: 24 });
  return <IdeasClient initialData={meals} />;
}
