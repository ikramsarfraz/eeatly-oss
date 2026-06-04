"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { capturePostHogEvent } from "@/components/providers/posthog-provider";

type AuthEmailFormProps = {
  mode: "sign-in" | "sign-up";
  /** Prefill the email input (set when arriving from an invite link). */
  initialEmail?: string;
  /** Override the post-verification redirect for returning users.
   *  When an invite link sends a signed-out user here, the page passes
   *  `/invite/[token]` so Better Auth returns them to the accept dialog
   *  instead of the dashboard. New users still onboard first; the
   *  invite token survives via the cookie set on click. */
  callbackURL?: string;
};

export function AuthEmailForm({ mode, initialEmail, callbackURL }: AuthEmailFormProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const isSignUp = mode === "sign-up";
  // Fire-and-forget analytics; we don't care about the result.
  const trackAuthFunnel = trpc.analytics.trackAuthFunnel.useMutation();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSubmittedEmail(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = email.split("@")[0] || "eeatly user";

    // Build ABSOLUTE callback URLs from the current origin so the verified
    // link returns the user to the host they signed in on. Without this, the
    // callback path resolves against the server's BETTER_AUTH_URL (the root
    // host), so signing in on `admin.<root>` would dump you on the root
    // dashboard instead of the admin surface. The shared cross-subdomain
    // cookie keeps the session valid across hosts; admin.<root> is a trusted
    // origin, so Better Auth honors the absolute URL.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const onAdminHost =
      typeof window !== "undefined" &&
      window.location.hostname.startsWith("admin.");
    const toAbsolute = (path: string) =>
      origin && path.startsWith("/") ? `${origin}${path}` : path;
    // Invite links forward an explicit callbackURL — that wins. Otherwise the
    // admin host lands on the admin home, everyone else on the dashboard.
    const returningDest = callbackURL ?? (onAdminHost ? "/admin/analytics" : "/home");
    const newUserDest = onAdminHost ? "/admin/analytics" : "/onboarding";

    try {
      const result = await authClient.signIn.magicLink({
        email,
        name,
        callbackURL: toAbsolute(returningDest),
        newUserCallbackURL: toAbsolute(newUserDest)
      });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmittedEmail(email);
      // New-user signups are tracked server-side at true account creation
      // (Better Auth `user.create` hook) — not here at link-request time,
      // which fired before the account even existed. We only record a
      // returning sign-in here; no user-create hook runs for an existing
      // account.
      if (!isSignUp) {
        trackAuthFunnel.mutate({ name: "signed_in" });
        capturePostHogEvent("signed_in");
      }
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again later.");
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
              We sent an eeatly link to{" "}
              <span className="font-medium text-foreground">{submittedEmail}</span>.
            </p>
          </div>
        </div>
        <p className="text-xs">
          The link opens your private dashboard. You can request another link if it
          does not arrive in a minute or two.
        </p>
        <Button type="button" variant="outline" onClick={() => setSubmittedEmail(null)}>
          Use a different email
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
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {pending
          ? "Sending link..."
          : isSignUp
            ? "Send my starter link"
            : "Send my sign-in link"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll send you a link — no password needed.
      </p>
    </form>
  );
}
