import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your eeatly account."
};

// Token + error arrive in the query at request time (Better Auth's
// reset-callback redirect), so this page can't be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  // No token, or Better Auth flagged the link as expired/used on the callback.
  if (!token || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link has expired</CardTitle>
          <CardDescription>
            Password reset links can only be used once and expire after an hour.
            Request a fresh one and we will email it over.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button asChild>
            <Link href={"/forgot-password" as Route}>Request a new link</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" href="/sign-in">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
