"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export type InviteEmailMismatchProps = {
  invitedEmail: string;
  currentEmail: string;
  /** Where the user should land after signing out — a pre-filled
   *  /sign-in URL with `email` + `callbackURL` so the magic-link round
   *  trip returns them to the invite page as the correct user. Built
   *  on the server so the client can't tamper with it. */
  redirectTo: string;
};

export function InviteEmailMismatch({
  invitedEmail,
  currentEmail,
  redirectTo
}: InviteEmailMismatchProps) {
  const [error, setError] = React.useState<string | null>(null);
  const signOutMutation = trpc.auth.signOutAndRedirect.useMutation();
  const pending = signOutMutation.isPending;

  async function handleSignOut() {
    setError(null);
    try {
      const result = await signOutMutation.mutateAsync({ redirectTo });
      // Full-page navigation so the cleared cookie takes effect.
      window.location.assign(result.redirectTo);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't sign you out. Please try again."
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>This invitation is for a different email</CardTitle>
        <CardDescription>
          This invite was sent to{" "}
          <span className="font-medium text-foreground">{invitedEmail}</span>,
          but you&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{currentEmail}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button type="button" onClick={handleSignOut} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {pending
            ? "Signing out…"
            : `Sign out and accept as ${invitedEmail}`}
        </Button>
        <Button asChild variant="outline">
          <Link href={"/dashboard" as Route}>Cancel</Link>
        </Button>
        {error && <p className="text-[12.5px] text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
