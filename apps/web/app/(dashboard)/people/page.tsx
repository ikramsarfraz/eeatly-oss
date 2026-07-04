import { loadHousehold } from "@/lib/auth/rls";
import { getPeopleOverview } from "@/services/connections";
import { PeopleClient } from "@/components/people/people-client";

/**
 * People — the sharing circle (per-item sharing model, Phase 2).
 *
 * Replaces the old household "Members" page. User-scoped: connections are
 * between users, independent of households. Server fetches the overview
 * once for a fast first paint; the client re-fetches via tRPC so invite /
 * cancel / share / un-share mutations update in place.
 */
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const overview = await loadHousehold(({ user }) => getPeopleOverview(user.id));

  return <PeopleClient initialOverview={overview} />;
}
