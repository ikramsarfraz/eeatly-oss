import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { ExportDataCard } from "@/components/account/export-data-card";
import { HouseholdCard } from "@/components/account/household-card";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { PreferencesCard } from "@/components/account/preferences-card";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { households, users } from "@/db/schema";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import {
  listHouseholdMembers,
  listPendingInvitations
} from "@/services/households";

export default async function SettingsPage() {
  const { user, household } = await requireCurrentUserWithHousehold();

  // Pull the captured onboarding habits so the preferences card can show
  // them. A null row would mean a user predating the columns — UI treats
  // both as "unset" and lets them pick.
  const [prefsRow] = await db
    .select({
      cooksPerWeek: users.cooksPerWeek,
      weeknightEffort: users.weeknightEffort
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Household data: owner pointer, members, pending invitations.
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

  return (
    <div className="grid max-w-3xl gap-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your eeatly account and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your eeatly account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1 rounded-lg border bg-background/60 p-4">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="grid gap-1 rounded-lg border bg-background/60 p-4">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
        </CardContent>
      </Card>

      <PreferencesCard
        cooksPerWeek={prefsRow?.cooksPerWeek ?? null}
        weeknightEffort={prefsRow?.weeknightEffort ?? null}
      />

      <HouseholdCard
        householdName={household.name}
        currentUserId={user.id}
        isOwner={isOwner}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          joinedAt: m.joinedAt.toISOString()
        }))}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          createdAt: i.createdAt.toISOString(),
          expiresAt: i.expiresAt.toISOString()
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your cooking history</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your cooking history is shared with everyone in your kitchen. eeatly uses it
          to help your household remember meals you all love and suggest what to cook again.
        </CardContent>
      </Card>

      <ExportDataCard />

      <Card>
        <CardHeader>
          <CardTitle>Help improve eeatly</CardTitle>
          <CardDescription>
            Tell us what felt confusing, useful, or missing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackDialog />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>
            Sign out of your eeatly account on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>

      <DeleteAccountCard />

      <div className="flex gap-4 text-sm text-muted-foreground">
        <Link href={"/privacy" as Route} className="hover:text-foreground">
          Privacy
        </Link>
        <Link href={"/help" as Route} className="hover:text-foreground">
          Help
        </Link>
      </div>
    </div>
  );
}
