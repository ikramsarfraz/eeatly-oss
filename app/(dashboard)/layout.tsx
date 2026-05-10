import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { requireCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();

  return (
    <QueryProvider>
      <ToastProvider>
        <AppShell user={user} canWrite>
          {children}
        </AppShell>
      </ToastProvider>
    </QueryProvider>
  );
}
