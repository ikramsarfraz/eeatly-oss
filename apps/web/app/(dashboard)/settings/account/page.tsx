import type { Metadata } from "next";
import { RouteSection } from "@/components/settings/route-section";
import { AccountCard } from "@/components/settings/account-card";
import { ChangePasswordCard } from "@/components/account/change-password-card";
import { loadAuthed } from "@/lib/auth/rls";
import { userHasPassword } from "@/services/account";

export const metadata: Metadata = { title: "Settings · Account" };

export default async function AccountSettingsPage() {
  const { user, hasPassword } = await loadAuthed(async (user) => ({
    user,
    hasPassword: await userHasPassword(user.id)
  }));
  return (
    <RouteSection title="Account" lede="Your name, the email you sign in with, and your password.">
      <AccountCard initialName={user.name} email={user.email} />
      <ChangePasswordCard hasPassword={hasPassword} email={user.email} />
    </RouteSection>
  );
}
