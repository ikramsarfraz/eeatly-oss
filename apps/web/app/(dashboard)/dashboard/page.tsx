import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { WelcomeToast } from "@/components/dashboard/welcome-toast";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getDashboardMeals } from "@/services/meals";

export default async function DashboardPage() {
  // Round 11: server components read services directly. tRPC is the
  // client-driven interaction layer; routing every SSR fetch through
  // it would add network latency for no benefit.
  const { user, household } = await requireCurrentUserWithHousehold();
  const meals = await getDashboardMeals(user.id, household.id);

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
