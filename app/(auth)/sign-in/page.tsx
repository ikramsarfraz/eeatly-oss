import Link from "next/link";
import type { Metadata } from "next";
import { AuthEmailForm } from "@/components/forms/auth-email-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your private CookLoop cooking memory."
};

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a private sign-in link. No password needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <AuthEmailForm mode="sign-in" />
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
