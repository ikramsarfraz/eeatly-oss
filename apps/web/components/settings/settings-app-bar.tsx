"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { MobileAppBar } from "@/components/mobile/mobile-app-bar";

const SECTION_TITLES: Record<string, string> = {
  account: "Account",
  plan: "Plan",
  sharing: "Sharing & privacy",
  kitchen: "Kitchen",
  notifications: "Notifications",
  appearance: "Appearance",
  advanced: "Advanced",
  danger: "Danger zone"
};

/**
 * R37 — the mobile Settings app bar. Reads the pathname to drive the shared
 * `MobileAppBar`: on the index it's a hamburger + "Settings"; on a section it's
 * a back chevron + the section name (back returns to the index). `md:hidden`.
 */
export function SettingsAppBar({
  userName,
  userEmail
}: {
  userName: string | null;
  userEmail: string | null;
}) {
  const pathname = usePathname() ?? "/settings";
  const key = pathname.replace(/^\/settings\/?/, "").split("/")[0];
  const isIndex = key.length === 0;
  const title = isIndex ? "Settings" : SECTION_TITLES[key] ?? "Settings";

  return (
    <div className="-mx-4 -mt-5 mb-2 md:hidden">
      <MobileAppBar
        title={title}
        backHref={isIndex ? undefined : "/settings"}
        userName={userName}
        userEmail={userEmail}
      />
    </div>
  );
}

/**
 * Bare `/settings` lands on `/settings/account` on desktop (the two-pane layout
 * needs an active section), while mobile shows the grouped index. A server
 * redirect can't branch on viewport, so this client helper navigates only at
 * `md+`. Renders nothing.
 */
export function RedirectToAccountOnDesktop() {
  const router = useRouter();
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      router.replace("/settings/account");
    }
  }, [router]);
  return null;
}
