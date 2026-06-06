import Link from "next/link";
import type { Metadata } from "next";
import { AuthEmailForm } from "@/components/forms/auth-email-form";
import { GoogleAuthButton } from "@/components/forms/google-auth-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { hasGoogleAuthEnv } from "@/lib/env/server";
import { sanitizeCallbackURL } from "@/lib/auth/callback-url";

export const metadata: Metadata = {
  title: "Start your cooking memory",
  description: "Create a private eeatly account with an email magic link."
};

// R15.5 Task 1 — auth pages call hasGoogleAuthEnv() / auth.api.getSession,
// both of which trigger getServerEnv(). Marking as dynamic skips the
// static-prerender step that would otherwise crash a build run without
// production env vars present (the env access during prerender has no
// `process.env` to read from). The pages are user-specific by nature.
export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; callbackURL?: string }>;
}) {
  const googleEnabled = hasGoogleAuthEnv();
  const { email, callbackURL } = await searchParams;
  const safeCallback = sanitizeCallbackURL(callbackURL);
  const initialEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your cooking memory</CardTitle>
        <CardDescription>
          Create your private eeatly account with an email and password, or a one-tap email link.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {googleEnabled ? (
          <>
            <GoogleAuthButton mode="sign-up" callbackURL={safeCallback} />
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}
        <AuthEmailForm
          mode="sign-up"
          initialEmail={initialEmail}
          callbackURL={safeCallback}
        />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" href="/sign-in">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
