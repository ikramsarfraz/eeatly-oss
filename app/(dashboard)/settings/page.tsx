import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function SettingsPage() {
  const user = await requireCurrentUser();

  return (
    <div className="grid max-w-3xl gap-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your CookLoop account and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your CookLoop account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1 rounded-lg border bg-background/60 p-4">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="grid gap-1 rounded-lg border bg-background/60 p-4">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your cooking history</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your cooking history is private to your account. CookLoop uses it to help you
          remember meals you love and suggest what to cook again.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Help improve CookLoop</CardTitle>
          <CardDescription>
            Tell us what felt confusing, useful, or missing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackDialog />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>
            Sign out of your CookLoop account on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
