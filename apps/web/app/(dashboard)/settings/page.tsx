import { requireCurrentUser } from "@/lib/auth/session";
import { SettingsMobileIndex } from "@/components/settings/settings-mobile-index";
import { RedirectToAccountOnDesktop } from "@/components/settings/settings-app-bar";

/**
 * `/settings` — on mobile this is the grouped, drill-down index (a real menu);
 * on desktop it lands on `/settings/account` so the two-pane layout has an
 * active section (the redirect runs client-side at `md+`, see
 * `RedirectToAccountOnDesktop`).
 */
export default async function SettingsIndexPage() {
  const user = await requireCurrentUser();
  const version = process.env.npm_package_version ?? "dev";
  return (
    <>
      <SettingsMobileIndex userName={user.name} version={version} />
      <RedirectToAccountOnDesktop />
    </>
  );
}
