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
import { SubscriptionCard } from "@/components/account/subscription-card";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { PreferencesCard } from "@/components/account/preferences-card";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { households, users } from "@/db/schema";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hasStripeEnv } from "@/lib/env/server";
import { getSubscriptionState } from "@/services/billing";
import {
  listHouseholdMembers,
  listPendingInvitations
} from "@/services/households";

export default async function SettingsPage() {
  const { user, household } = await requireCurrentUserWithHousehold();

  // Pull the captured onboarding habits + beta cohort so the
  // preferences and subscription cards can render. Beta cohort
  // surfaces a subtle indicator on the SubscriptionCard.
  const [prefsRow] = await db
    .select({
      cooksPerWeek: users.cooksPerWeek,
      weeknightEffort: users.weeknightEffort,
      betaCohort: users.betaCohort
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Stripe-side state for the SubscriptionCard. Returns null for free-
  // tier users; the component branches on the shape.
  const billingConfigured = hasStripeEnv();
  const subscription = billingConfigured
    ? await getSubscriptionState({ userId: user.id })
    : null;

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

      <SubscriptionCard
        subscription={
          subscription
            ? {
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
              }
            : null
        }
        isBetaCohort={Boolean(prefsRow?.betaCohort)}
        billingConfigured={billingConfigured}
      />

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
