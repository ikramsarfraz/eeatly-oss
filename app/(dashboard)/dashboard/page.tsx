import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardMealsAction } from "@/actions/meals";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const [user, meals] = await Promise.all([
    requireCurrentUser(),
    getDashboardMealsAction()
  ]);

  return <DashboardClient initialData={meals} currentUserId={user.id} />;
}
