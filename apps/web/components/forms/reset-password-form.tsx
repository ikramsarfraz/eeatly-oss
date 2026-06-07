"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Set a new password from a reset link. The `token` arrives in the page's
 * query string (`/reset-password?token=…`), placed there by Better Auth's
 * reset-callback after it verified the token server-side. On success the
 * user is NOT auto-signed-in (Better Auth doesn't issue a session here), so
 * we send them to sign in with the new password.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(
          result.error.code === "INVALID_TOKEN"
            ? "This reset link has expired or already been used. Request a new one."
            : result.error.message ?? "We couldn't reset your password. Please try again."
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Password reset is temporarily unavailable. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Password updated</p>
            <p className="mt-1">You can now sign in with your new password.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/sign-in">Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
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

      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type={showPassword ? "text" : "password"}
          placeholder="Re-enter your new password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? "Updating password..." : "Update password"}
      </Button>
    </form>
  );
}
