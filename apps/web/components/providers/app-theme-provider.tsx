"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";

/**
 * The single app-wide theme provider (next-themes, class strategy on `<html>`).
 *
 * Default is LIGHT with no OS tracking (`enableSystem={false}`), so a dark-OS
 * user still gets light unless they explicitly choose Dark in Settings.
 *
 * The marketing, public (privacy / help / pricing), and auth (sign-in /
 * sign-up) pages are the product's "front door" and are ALWAYS shown in light
 * mode, even for a signed-in user who picked Dark. We do that by forcing the
 * theme to light on those routes via `forcedTheme`. `forcedTheme` does not
 * touch the saved preference, so Dark mode in the dashboard is unaffected; when
 * the user navigates back into the app, `forcedTheme` clears and their saved
 * choice applies again. Driving it off `usePathname` keeps it to the single
 * root provider (nested next-themes providers don't reliably win the shared
 * `<html>` class).
 */
const LIGHT_ONLY_PREFIXES = ["/sign-in", "/sign-up", "/privacy", "/help", "/pricing"];

function isLightOnlyRoute(pathname: string): boolean {
  if (pathname === "/") return true; // marketing landing
  return LIGHT_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const forcedTheme = isLightOnlyRoute(pathname) ? "light" : undefined;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      {children}
    </ThemeProvider>
  );
}
