import type { Metadata } from "next";
import { RouteSection } from "@/components/settings/route-section";
import { AccountCard } from "@/components/settings/account-card";
import { requireCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings · Account" };

export default async function AccountSettingsPage() {
  const user = await requireCurrentUser();
  return (
    <RouteSection title="Account" lede="Your name and the email you sign in with.">
      <AccountCard initialName={user.name} email={user.email} />
    </RouteSection>
  );
}
