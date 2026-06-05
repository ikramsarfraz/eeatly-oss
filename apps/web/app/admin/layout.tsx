import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { noIndexMetadata } from "@/lib/seo/no-index";

export const dynamic = "force-dynamic";

// Platform admin must never be indexed or followed.
export const metadata = noIndexMetadata;

/**
 * Admin layout — gates the whole `/admin/*` subtree on the platform-admin role
 * (+ optional host) and wraps it in the shared sidebar shell. Each page still
 * calls `requirePlatformAdmin` too; the lookup is request-cached, so the
 * double-check is free and keeps pages safe if rendered outside this layout.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();
  return <AdminShell user={user}>{children}</AdminShell>;
}
