import type { Metadata } from "next";
import { RouteSection } from "@/components/settings/route-section";
import { AccountCard } from "@/components/settings/account-card";
import { ChangePasswordCard } from "@/components/account/change-password-card";
import { requireCurrentUser } from "@/lib/auth/session";
import { userHasPassword } from "@/services/account";

export const metadata: Metadata = { title: "Settings · Account" };

export default async function AccountSettingsPage() {
  const user = await requireCurrentUser();
  const hasPassword = await userHasPassword(user.id);
  return (
    <RouteSection title="Account" lede="Your name, the email you sign in with, and your password.">
      <AccountCard initialName={user.name} email={user.email} />
      <ChangePasswordCard hasPassword={hasPassword} email={user.email} />
    </RouteSection>
  );
}
