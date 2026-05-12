import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardMealsAction } from "@/actions/meals";

export default async function DashboardPage() {
  const meals = await getDashboardMealsAction();

  return <DashboardClient initialData={meals} />;
}
