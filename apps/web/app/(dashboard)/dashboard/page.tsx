import { Suspense } from "react";
import { HomeClient } from "@/components/dashboard/home-client";
import { WelcomeToast } from "@/components/dashboard/welcome-toast";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { getDashboardMeals } from "@/services/meals";

/**
 * Round 26 — Home (dashboard) page.
 *
 * Server reads `dashboardMeals` directly via the service (R11
 * convention — tRPC is client-driven; SSR fetches don't need to
 * round-trip through it) and hands the result + current user
 * identity off to the client. All interactive surfaces (recents
 * grid links, upcoming-plan card, quick-log form, top-bar action)
 * live inside `<HomeClient>`.
 *
 * The R25 `<DashboardClient>` was the previous renderer; replaced
 * here by `<HomeClient>`. The old file stays on disk in case any
 * follow-up wants its hero copy; it can be removed once R26 settles.
 */
export default async function DashboardPage() {
  const { user, household } = await requireCurrentUserWithHousehold();
  // Run the household-scoped meals query — the household lookup
  // doubles as the auth gate (`requireHouseholdMember` runs inside
  // `getDashboardMeals`).
  const meals = await getDashboardMeals(user.id, household.id);

  return (
    <>
      {/* useSearchParams requires a Suspense boundary in Next 15. The
          fallback is null because the toast is purely a side-effect. */}
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <HomeClient
        initialData={meals}
        currentUserId={user.id}
        currentUserName={user.name ?? null}
      />
    </>
  );
}
