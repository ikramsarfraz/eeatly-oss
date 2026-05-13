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

  // Signed-out: instruct the user to sign in as the invited email. The
  // magic-link flow lands on /dashboard, so we keep the instruction
  // explicit rather than building a callback handoff in this round.
  if (!user) {
    const signUpHref =
      `/sign-up?email=${encodeURIComponent(invitation.email)}` as Route;
    const signInHref =
      `/sign-in?email=${encodeURIComponent(invitation.email)}` as Route;
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {invitation.inviterName} invited you to {invitation.householdName}
          </CardTitle>
          <CardDescription>
            Sign in (or sign up) as{" "}
            <span className="font-medium text-foreground">{invitation.email}</span>{" "}
            and reopen this invitation link to join.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button asChild>
            <Link href={signInHref}>Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={signUpHref}>Create an account</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Signed-in but the email doesn't match. Surface clearly — don't let the
  // accept action throw with a generic error.
  if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation is for a different email</CardTitle>
          <CardDescription>
            This invite was sent to{" "}
            <span className="font-medium text-foreground">{invitation.email}</span>,
            but you&apos;re signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>. Sign
            out and sign in with the invited email to accept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={"/settings" as Route}>Go to settings</Link>
          </Button>
        </CardContent>
      </Card>
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
