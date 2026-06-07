import Link from "next/link";
import type { Route } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsAppBar } from "@/components/settings/settings-app-bar";
import { requireCurrentUser } from "@/lib/auth/session";

/**
 * R32 — Settings parent shell. Renders the editorial frame shared by every
 * settings route: a sticky left route-nav (with the "Settings." heading) and
 * a content column the active child route renders into. The app sidebar +
 * topbar come from the dashboard `AppShell`; this is just the inner frame.
 *
 * R37 — mobile gets the shared app bar (hamburger/back · title · search ·
 * avatar) at the top; the desktop route-nav is hidden below `md` (the grouped
 * index + drill-down replace it), which also removes the old duplicate title.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const version = process.env.npm_package_version ?? "dev";
  const user = await requireCurrentUser();

  return (
    <div className="pb-20 md:pb-0">
      <SettingsAppBar userName={user.name} userEmail={user.email} />

      <div className="relative grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* Version tag — top-right of the frame. */}
        <span
          className="pointer-events-none absolute right-0 top-0 hidden font-mono text-[10.5px] uppercase text-muted-foreground/70 lg:block"
          style={{ letterSpacing: "0.14em" }}
        >
          eeatly · v{version}
        </span>

        <div className="hidden md:block">
          <SettingsNav />
        </div>

        <div className="grid content-start gap-8">
          {children}

          <footer className="mt-2 text-[11.5px] text-muted-foreground">
            Privacy ·{" "}
            <Link href={"/privacy" as Route} className="underline-offset-2 hover:underline">
              privacy policy
            </Link>{" "}
            · Help ·{" "}
            <Link href={"/help" as Route} className="underline-offset-2 hover:underline">
              help center
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
