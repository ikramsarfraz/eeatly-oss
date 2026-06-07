"use client";

import * as React from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingRow } from "@/components/settings/setting-row";
import { useToast } from "@/components/providers/toast-provider";
import { authClient } from "@/lib/auth/client";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Settings → Account "Password" card.
 *
 * Two shapes, decided server-side by `hasPassword`:
 *   - Has a password (signed up with email + password, or set one via reset):
 *     an edit-mode form that verifies the current password and sets a new one
 *     through Better Auth's `changePassword`. Other sessions are revoked, so a
 *     leaked old password can't keep a stale device signed in.
 *   - No password (magic-link / Google only): there's no current password to
 *     verify, so we offer to email a link to SET one (the same reset flow).
 */
export function ChangePasswordCard({
  hasPassword,
  email
}: {
  hasPassword: boolean;
  email: string;
}) {
  if (!hasPassword) {
    return <SetPasswordCard email={email} />;
  }
  return <ChangePasswordForm />;
}

function CardShell({
  action,
  children
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border-soft,var(--border))] px-5 py-3.5">
        <span
          className="font-mono text-[10px] font-semibold uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          Password
        </span>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ChangePasswordForm() {
  const { showToast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setShowPassword(false);
  }
  function cancel() {
    reset();
    setEditing(false);
  }

  async function save() {
    setError(null);
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true
      });
      if (result.error) {
        setError(
          result.error.code === "INVALID_PASSWORD"
            ? "Your current password is incorrect."
            : result.error.message ?? "Couldn't update your password. Please try again."
        );
        return;
      }
      showToast({ variant: "success", title: "Password updated" });
      cancel();
    } catch {
      setError("Password change is temporarily unavailable. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <CardShell
        action={
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(true)}>
            <KeyRound className="h-3.5 w-3.5" />
            Change
          </Button>
        }
      >
        <SettingRow
          label="Password"
          value="••••••••"
          sub="Used with your email to sign in."
          last
        />
      </CardShell>
    );
  }

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((s) => !s)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
  const inputType = showPassword ? "text" : "password";

  return (
    <CardShell>
      <div className="grid gap-4 px-5 py-5">
        <div className="grid gap-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={inputType}
              autoComplete="current-password"
              value={current}
              disabled={pending}
              onChange={(e) => setCurrent(e.target.value)}
              className="pr-10"
            />
            {eyeToggle}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type={inputType}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={next}
            disabled={pending}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type={inputType}
            autoComplete="new-password"
            value={confirm}
            disabled={pending}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-[12px] text-muted-foreground">
          Changing your password signs you out on your other devices.
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-[var(--border-soft,var(--border))] bg-[var(--surface-2)] px-5 py-3">
        <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={pending || !current || !next || !confirm}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Update password
        </Button>
      </div>
    </CardShell>
  );
}

function SetPasswordCard({ email }: { email: string }) {
  const { showToast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function requestLink() {
    setPending(true);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password"
      });
      if (result.error) {
        showToast({
          variant: "error",
          title: "Couldn't send the link",
          description: result.error.message ?? undefined
        });
        return;
      }
      setSent(true);
    } catch {
      showToast({ variant: "error", title: "Couldn't send the link. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <CardShell>
      <div className="grid gap-4 px-5 py-5 text-sm text-muted-foreground">
        <p>
          You sign in with a magic link or Google. Add a password to also sign in with
          your email and a password.
        </p>
        {sent ? (
          <div className="flex items-start gap-2 text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <p>
              Check <span className="font-medium">{email}</span> for a link to set your
              password.
            </p>
          </div>
        ) : (
          <Button variant="outline" className="w-fit" onClick={requestLink} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email me a link to set a password
          </Button>
        )}
      </div>
    </CardShell>
  );
}
