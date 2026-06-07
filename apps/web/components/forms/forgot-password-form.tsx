"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

/**
 * Request a password-reset link. We always show the same confirmation whether
 * or not the email maps to an account, mirroring Better Auth's generic
 * server response, so this form can't be used to enumerate accounts.
 *
 * `redirectTo` is the RELATIVE path the email link lands on after Better Auth
 * verifies the token: `/reset-password?token=…`. A relative path keeps it on
 * the app origin (passes the server-side origin check) with no open-redirect
 * surface.
 */
export function ForgotPasswordForm({ initialEmail }: { initialEmail?: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password"
      });
      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmittedEmail(email);
    } catch {
      setError("Password reset is temporarily unavailable. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  if (submittedEmail) {
    return (
      <div className="grid gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Check your email</p>
            <p className="mt-1">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{submittedEmail}</span>, we
              sent a link to reset your password.
            </p>
          </div>
        </div>
        <p className="text-xs">
          The link expires in an hour. You can request another if it does not arrive in
          a minute or two.
        </p>
        <Button asChild variant="outline">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          defaultValue={initialEmail ?? ""}
          autoComplete="email"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {pending ? "Sending link..." : "Email me a reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link className="font-medium text-primary hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
