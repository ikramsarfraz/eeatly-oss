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
  title: "Start your cooking memory",
  description: "Create a private CookLoop account with an email magic link."
};

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your cooking memory</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a link to create your private CookLoop.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
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
