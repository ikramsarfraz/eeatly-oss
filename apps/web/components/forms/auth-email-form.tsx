"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

const MIN_PASSWORD_LENGTH = 8;

export function AuthEmailForm({ mode, initialEmail, callbackURL }: AuthEmailFormProps) {
  const router = useRouter();
  const [method, setMethod] = React.useState<"password" | "link">("password");
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const isSignUp = mode === "sign-up";
  // Fire-and-forget analytics; we don't care about the result.
  const trackAuthFunnel = trpc.analytics.trackAuthFunnel.useMutation();

  // Build ABSOLUTE callback URLs from the current origin so the verified link /
  // post-auth navigation returns the user to the host they signed in on (see
  // the long-form note that used to live inline: the admin subdomain needs the
  // absolute URL, and the shared cross-subdomain cookie keeps the session
  // valid across hosts). Computed once per submit.
  function resolveDestinations() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const onAdminHost =
      typeof window !== "undefined" && window.location.hostname.startsWith("admin.");
    const toAbsolute = (path: string) =>
      origin && path.startsWith("/") ? `${origin}${path}` : path;
    const returningDest = callbackURL ?? (onAdminHost ? "/admin/analytics" : "/home");
    const newUserDest = onAdminHost ? "/admin/analytics" : "/onboarding";
    return { toAbsolute, returningDest, newUserDest };
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSubmittedEmail(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const name = email.split("@")[0] || "eeatly user";
    const { toAbsolute, returningDest, newUserDest } = resolveDestinations();

    try {
      if (method === "password") {
        if (password.length < MIN_PASSWORD_LENGTH) {
          setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
          return;
        }

        if (isSignUp) {
          const result = await authClient.signUp.email({
            email,
            password,
            name,
            callbackURL: toAbsolute(newUserDest)
          });
          if (result.error) {
            setError(
              result.error.message ?? "We couldn't create your account. Please try again."
            );
            return;
          }
          // `autoSignIn` (server config) issues the session; the user.create
          // hook records the signup. Navigate to onboarding for new accounts.
          router.replace(newUserDest as Route);
          router.refresh();
          return;
        }

        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: toAbsolute(returningDest)
        });
        if (result.error) {
          setError(
            result.error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "That email and password don't match. Try again, or email yourself a link."
              : result.error.message ?? "Something went wrong. Please try again."
          );
          return;
        }
        trackAuthFunnel.mutate({ name: "signed_in" });
        capturePostHogEvent("signed_in");
        router.replace(returningDest as Route);
        router.refresh();
        return;
      }

      // Magic-link method — emails a one-tap link (no password).
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
      // (Better Auth `user.create` hook). We only record a returning sign-in
      // here; no user-create hook runs for an existing account.
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

  const usePassword = method === "password";

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

      {usePassword ? (
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={isSignUp ? "At least 8 characters" : "Your password"}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : usePassword ? (
          <KeyRound className="h-4 w-4" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {pending
          ? usePassword
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : "Sending link..."
          : usePassword
            ? isSignUp
              ? "Create account"
              : "Sign in"
            : isSignUp
              ? "Send my starter link"
              : "Send my sign-in link"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setError(null);
          setMethod((m) => (m === "password" ? "link" : "password"));
        }}
        className={cn(
          "text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        )}
      >
        {usePassword
          ? "Email me a sign-in link instead (no password)"
          : "Use a password instead"}
      </button>
    </form>
  );
}
