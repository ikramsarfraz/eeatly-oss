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
  title: "Sign in",
  description: "Sign in to your private eeatly meal memory."
};

// R15.5 Task 1 — see same comment on sign-up; the page reads env-driven
// social-provider flags and so cannot be safely prerendered with no env.
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; callbackURL?: string }>;
}) {
  const googleEnabled = hasGoogleAuthEnv();
  const { email, callbackURL } = await searchParams;
  // Sanitize at the page boundary — callbackURL comes from a URL the
  // user followed (e.g. from an invite link). Open-redirect protection
  // lives in sanitizeCallbackURL.
  const safeCallback = sanitizeCallbackURL(callbackURL);
  const initialEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a private sign-in link. No password needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {googleEnabled ? (
          <>
            <GoogleAuthButton mode="sign-in" callbackURL={safeCallback} />
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}
        <AuthEmailForm
          mode="sign-in"
          initialEmail={initialEmail}
          callbackURL={safeCallback}
        />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link className="font-medium text-primary hover:underline" href="/sign-up">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
