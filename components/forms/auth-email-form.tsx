"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { trackAuthFunnelAction } from "@/actions/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

type AuthEmailFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthEmailForm({ mode }: AuthEmailFormProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const isSignUp = mode === "sign-up";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSubmittedEmail(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = email.split("@")[0] || "CookLoop User";

    try {
      const result = await authClient.signIn.magicLink({
        email,
        name,
        callbackURL: "/dashboard",
        newUserCallbackURL: "/dashboard"
      });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
        return;
      }

      setSubmittedEmail(email);
      void trackAuthFunnelAction(isSignUp ? "signed_up" : "signed_in");
    } catch {
      setError("Email sign-in is not available until Better Auth, email, and the database are configured.");
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
              We sent a CookLoop link to{" "}
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
        <Input id="email" name="email" type="email" placeholder="you@example.com" required />
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
        Magic links keep beta access simple and password-free.
      </p>
    </form>
  );
}
