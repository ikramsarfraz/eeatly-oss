import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { WelcomeToast } from "@/components/dashboard/welcome-toast";
import { getDashboardMealsAction } from "@/actions/meals";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const [user, meals] = await Promise.all([
    requireCurrentUser(),
    getDashboardMealsAction()
  ]);

  return (
    <>
      {/* useSearchParams requires a Suspense boundary in Next 15. The
          fallback is null because the toast is purely a side-effect. */}
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <DashboardClient initialData={meals} currentUserId={user.id} />
    </>
  );
}
