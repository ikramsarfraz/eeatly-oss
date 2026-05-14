import Link from "next/link";
import type { Route } from "next";
import { ChefHat } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInvitationCard } from "@/components/account/accept-invitation-card";
import { InviteEmailMismatch } from "@/components/account/invite-email-mismatch";
import { buildAuthCallbackHref } from "@/lib/auth/callback-url";
import { getCurrentUser, type AppUser } from "@/lib/auth/session";
import {
  findInvitationContextByToken,
  type InvitationContext
} from "@/services/households";

export const dynamic = "force-dynamic";

export default async function InviteAcceptPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await findInvitationContextByToken(token);
  const user = await getCurrentUser();

  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-screen place-items-center px-4 py-8"
    >
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold">eeatly</span>
        </Link>

        <InvitationView invitation={invitation} user={user} token={token} />

        <div className="mt-5 flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href={"/privacy" as Route} className="hover:text-foreground">
            Privacy
          </Link>
          <Link href={"/help" as Route} className="hover:text-foreground">
            Help
          </Link>
        </div>
      </div>
    </main>
  );
}

function InvitationView({
  invitation,
  user,
  token
}: {
  invitation: InvitationContext | null;
  user: AppUser | null;
  token: string;
}) {
  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation not found</CardTitle>
          <CardDescription>
            This link doesn&apos;t match a pending invitation. It may have been
            revoked, or it might be mistyped.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (invitation.acceptedAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation was already accepted</CardTitle>
          <CardDescription>
            Sign in to {invitation.householdName} to see the shared kitchen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={"/dashboard" as Route}>Open eeatly</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation has expired</CardTitle>
          <CardDescription>
            Ask {invitation.inviterName} to send a new invite from their eeatly
            settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Signed-out: pass the invite path through as `callbackURL` so Better
  // Auth returns the user to /invite/[token] after magic-link verification
  // and the accept dialog renders without a second click.
  if (!user) {
    const callback = `/invite/${token}`;
    const signInHref = buildAuthCallbackHref("/sign-in", {
      email: invitation.email,
      callbackURL: callback
    }) as Route;
    const signUpHref = buildAuthCallbackHref("/sign-up", {
      email: invitation.email,
      callbackURL: callback
    }) as Route;
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {invitation.inviterName} invited you to {invitation.householdName}
          </CardTitle>
          <CardDescription>
            Sign in (or sign up) as{" "}
            <span className="font-medium text-foreground">{invitation.email}</span>{" "}
            to accept this invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button asChild>
            <Link href={signInHref}>Sign in to accept</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={signUpHref}>Create an account</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Signed-in but the email doesn't match. One-click "sign out and
  // continue as <invited_email>" — Round 8 papercut fix. The
  // post-signout redirect target is pre-built on the server (so the
  // client can't tamper with it) and routes through the same
  // callbackURL handoff the signed-out branch uses.
  if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
    const postSignOutTarget = buildAuthCallbackHref("/sign-in", {
      email: invitation.email,
      callbackURL: `/invite/${token}`
    });
    return (
      <InviteEmailMismatch
        invitedEmail={invitation.email}
        currentEmail={user.email}
        redirectTo={postSignOutTarget}
      />
    );
  }

  return (
    <AcceptInvitationCard
      token={token}
      inviterName={invitation.inviterName}
      householdName={invitation.householdName}
    />
  );
}
