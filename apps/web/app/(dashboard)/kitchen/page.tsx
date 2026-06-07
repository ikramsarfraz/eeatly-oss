import { eq } from "drizzle-orm";
import { households } from "@/db/schema";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import {
  listHouseholdMembers,
  listPendingInvitations
} from "@/services/households";
import { HouseholdClient } from "@/components/household/household-client";
import { MembersMobile } from "@/components/mobile/members-mobile";

/**
 * Round 31 — Kitchen page server shell.
 *
 * Promoted out of Settings into its own surface so the editorial hero
 * + Members + Pending invitations + Roles grid have room. Server-side
 * we resolve auth, pull the household's owner pointer (for `isOwner`),
 * and fan out the member list + pending-invitation list in parallel.
 * Non-owners get an empty invitations array — `listPendingInvitations`
 * is gated by `requireHouseholdMember`, but the UI still narrows so we
 * don't even round-trip for the data they can't act on.
 *
 * Breadcrumb mapping → `[Kitchen, Members]` lives in
 * `apps/web/lib/nav/breadcrumbs.ts`. The sidebar's Kitchen group
 * (R31 — restored from the R26-removed members link) deep-links here.
 */
export default async function HouseholdPage() {
  const { user, household } = await requireCurrentUserWithHousehold();

  const [householdRow] = await db
    .select({ ownerId: households.ownerId, createdAt: households.createdAt })
    .from(households)
    .where(eq(households.id, household.id))
    .limit(1);
  const isOwner = householdRow?.ownerId === user.id;

  const [members, invitations] = await Promise.all([
    listHouseholdMembers(user.id, household.id),
    isOwner
      ? listPendingInvitations(user.id, household.id)
      : Promise.resolve([])
  ]);

  const householdCreatedAt = (householdRow?.createdAt ?? new Date()).toISOString();
  const memberItems = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
    joinedAt: m.joinedAt.toISOString()
  }));
  const invitationItems = invitations.map((i) => ({
    id: i.id,
    email: i.email,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString()
  }));

  return (
    <>
      <MembersMobile
        householdName={household.name}
        householdCreatedAt={householdCreatedAt}
        currentUserId={user.id}
        isOwner={isOwner}
        members={memberItems}
        invitations={invitationItems}
      />
      <div className="hidden md:block">
        <HouseholdClient
          householdName={household.name}
          householdCreatedAt={householdCreatedAt}
          currentUserId={user.id}
          isOwner={isOwner}
          members={memberItems}
          invitations={invitationItems}
        />
      </div>
    </>
  );
}
