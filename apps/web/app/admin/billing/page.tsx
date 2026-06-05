import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { StripeCatalogPanel } from "@/components/admin/stripe-catalog-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Billing catalog · admin"
};

export default async function AdminBillingPage() {
  await requirePlatformAdmin();

  return (
    <main className="w-full px-5 py-5">
      <StripeCatalogPanel />
    </main>
  );
}
