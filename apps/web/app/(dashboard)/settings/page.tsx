import { eq } from "drizzle-orm";
import { households } from "@/db/schema";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hasStripeEnv } from "@/lib/env/server";
import { getSubscriptionState } from "@/services/billing";
import { listPendingInvitations, listHouseholdMembers } from "@/services/households";
import { SettingsClient } from "@/components/settings/settings-client";

/**
 * Round 31 — Settings server shell.
 *
 * Pulls the small bundle of data the redesigned `<SettingsClient>`
 * needs (auth user, household summary, owner flag, member +
 * pending-invitation counts, plan tier). The old card-list shell in
 * R23/R24/R25 fetched a bigger payload (full member list, preferences,
 * subscription dates, etc.) so each in-page card could render in
 * isolation — R31 moves member management to `/household` and lets
 * the new client renderer surface just the summary roll-ups, so we
 * only need the lighter projection here.
 */
export default async function SettingsPage() {
  const { user, household } = await requireCurrentUserWithHousehold();

  const [ownerRow] = await db
    .select({ ownerId: households.ownerId })
    .from(households)
    .where(eq(households.id, household.id))
    .limit(1);
  const isOwner = ownerRow?.ownerId === user.id;

  const billingConfigured = hasStripeEnv();
  const [members, invitations, subscription] = await Promise.all([
    listHouseholdMembers(user.id, household.id),
    isOwner
      ? listPendingInvitations(user.id, household.id)
      : Promise.resolve([]),
    billingConfigured ? getSubscriptionState({ userId: user.id }) : Promise.resolve(null)
  ]);

  const isPlus =
    subscription?.status === "active" || subscription?.status === "trialing";

  // Version label rendered as the small mono chip in the header. We
  // surface the web app's package version so the page doubles as a
  // diagnostic surface when teammates report a bug ("which build are
  // you on?"). Falls back to "dev" when the build-time env var is
  // missing.
  const version = process.env.npm_package_version ?? "dev";

  return (
    <div className="pb-20 md:pb-0">
      <SettingsClient
        user={{ name: user.name, email: user.email }}
        household={{ name: household.name }}
        memberCount={members.length}
        pendingInviteCount={invitations.length}
        isOwner={isOwner}
        isPlus={isPlus}
        version={version}
      />
    </div>
  );
}
