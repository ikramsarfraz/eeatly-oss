import Link from "next/link";
import type { Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectAcceptCard } from "@/components/people/connect-accept-card";
import { buildAuthCallbackHref } from "@/lib/auth/callback-url";
import { getCurrentUser } from "@/lib/auth/session";
import { findInvitationByToken } from "@/services/connections";
import { noIndexMetadata } from "@/lib/seo/no-index";

/**
 * Accept a sharing-circle invitation. Mirrors the household /invite flow:
 * resolve the invite + current user server-side; signed-out visitors get a
 * sign-in CTA that round-trips back here; signed-in visitors get an Accept
 * button (the actual connect happens client-side via tRPC).
 */
export const dynamic = "force-dynamic";

// Token-gated connect link — must never be indexed.
export const metadata = noIndexMetadata;

export default async function ConnectAcceptPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await findInvitationByToken(token);
  const user = await getCurrentUser();

  return (
    <main id="main" tabIndex={-1} className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center">
          <Wordmark size={32} />
        </Link>

        {!invitation ? (
          <Card>
            <CardHeader>
              <CardTitle>Invitation not found</CardTitle>
              <CardDescription>
                This invite link is invalid, was canceled, or has already been used.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : invitation.expired ? (
          <Card>
            <CardHeader>
              <CardTitle>Invitation expired</CardTitle>
              <CardDescription>
                Ask {invitation.inviterName ?? invitation.inviterEmail} to send a new invite.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : !user ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {invitation.inviterName ?? invitation.inviterEmail} wants to share with you
              </CardTitle>
              <CardDescription>
                Sign in to join their sharing circle. They&apos;ll be able to share individual
                recipes and plans with you — never their whole library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link
                  href={
                    buildAuthCallbackHref("/sign-in", {
                      callbackURL: `/connect/${token}`
                    }) as Route
                  }
                >
                  Sign in to accept
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ConnectAcceptCard
            token={token}
            inviterName={invitation.inviterName ?? invitation.inviterEmail}
          />
        )}
      </div>
    </main>
  );
}
