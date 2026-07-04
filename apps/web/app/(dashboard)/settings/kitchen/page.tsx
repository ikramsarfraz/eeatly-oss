import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { households } from "@/db/schema";
import { loadHousehold } from "@/lib/auth/rls";
import { db } from "@/lib/db/client";
import { listHouseholdMembers, listPendingInvitations } from "@/services/households";
import { RouteSection } from "@/components/settings/route-section";
import { KitchenSection } from "@/components/settings/section-bodies";

export const metadata: Metadata = { title: "Settings · Kitchen" };

export default async function KitchenSettingsPage() {
  const { household, members, invitations } = await loadHousehold(
    async ({ user, household }) => {
      const [ownerRow] = await db
        .select({ ownerId: households.ownerId })
        .from(households)
        .where(eq(households.id, household.id))
        .limit(1);
      const isOwner = ownerRow?.ownerId === user.id;
      const [members, invitations] = await Promise.all([
        listHouseholdMembers(user.id, household.id),
        isOwner ? listPendingInvitations(user.id, household.id) : Promise.resolve([])
      ]);
      return { household, members, invitations };
    }
  );

  return (
    <RouteSection title="Kitchen" lede="Your kitchen, members, and the units new recipes use.">
      <KitchenSection
        memberCount={members.length}
        pendingInviteCount={invitations.length}
        householdName={household.name}
      />
    </RouteSection>
  );
}
