import { Suspense } from "react";
import { HomeClient } from "@/components/dashboard/home-client";
import { HomeMobile } from "@/components/mobile/home-mobile";
import { WelcomeToast } from "@/components/dashboard/welcome-toast";
import { loadHousehold } from "@/lib/auth/rls";
import { getDashboardMeals } from "@/services/meals";
import { isHouseholdOwner } from "@/services/households";

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
  // Run the household-scoped meals query inside the RLS scope — the household
  // lookup doubles as the auth gate (`requireHouseholdMember` runs inside
  // `getDashboardMeals`).
  const { user, household, meals, ownsHousehold } = await loadHousehold(
    async ({ user, household }) => {
      const [meals, ownsHousehold] = await Promise.all([
        getDashboardMeals(user.id, household.id),
        isHouseholdOwner(user.id, household.id)
      ]);
      return { user, household, meals, ownsHousehold };
    }
  );

  return (
    <>
      {/* useSearchParams requires a Suspense boundary in Next 15. The
          fallback is null because the toast is purely a side-effect. */}
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <HomeMobile
        initialData={meals}
        currentUserName={user.name ?? null}
        householdName={household.name}
      />
      <div className="hidden md:block">
        <HomeClient
          initialData={meals}
          currentUserId={user.id}
          currentUserName={user.name ?? null}
          isHouseholdOwner={ownsHousehold}
        />
      </div>
    </>
  );
}
