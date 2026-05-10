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
        <p className="text-sm font-medium text-muted-foreground">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is used to keep meal history private to you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Basic account information for the authenticated shell.</CardDescription>
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
          <div className="flex items-center justify-between rounded-lg border bg-background/60 p-4">
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Role</span>
              <span className="font-medium">{user.role.replaceAll("_", " ")}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 p-4">
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Session</span>
              <span className="font-medium">Signed in with Better Auth</span>
            </div>
            <SignOutButton />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 p-4">
            <div className="grid gap-1">
              <span className="text-sm text-muted-foreground">Beta feedback</span>
              <span className="font-medium">Share bugs, confusion, or requests.</span>
            </div>
            <FeedbackDialog />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auth foundation</CardTitle>
          <CardDescription>
            CookLoop is prepared for root app users, tenant users, and platform admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tenant membership and platform-admin host routing are scaffolded in the schema and
          auth config, but intentionally kept light for the MVP.
        </CardContent>
      </Card>
    </div>
  );
}
