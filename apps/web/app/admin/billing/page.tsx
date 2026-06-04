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
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <StripeCatalogPanel />
    </main>
  );
}
