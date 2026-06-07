import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a link to reset your eeatly password."
};

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const initialEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we will send you a link to set a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm initialEmail={initialEmail} />
      </CardContent>
    </Card>
  );
}
