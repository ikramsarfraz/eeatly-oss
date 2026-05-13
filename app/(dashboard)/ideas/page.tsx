import type { Metadata } from "next";
import { getDashboardMealsAction } from "@/actions/meals";
import { IdeasClient } from "@/components/dashboard/ideas-client";

export const metadata: Metadata = {
  title: "Ideas",
  description: "Meals worth resurfacing tonight."
};

export default async function IdeasPage() {
  const meals = await getDashboardMealsAction();
  return <IdeasClient initialData={meals} />;
}
