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

export const metadata: Metadata = {
  title: "Start your cooking memory",
  description: "Create a private eeatly account with an email magic link."
};

export default function SignUpPage() {
  const googleEnabled = hasGoogleAuthEnv();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your cooking memory</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a link to create your private eeatly account.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {googleEnabled ? (
          <>
            <GoogleAuthButton mode="sign-up" />
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}
        <AuthEmailForm mode="sign-up" />
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
