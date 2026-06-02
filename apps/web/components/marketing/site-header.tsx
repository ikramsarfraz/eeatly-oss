"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { PRIMARY_NAV } from "@/lib/marketing-nav";

/**
 * Single light/dark icon toggle for the marketing chrome. The decision
 * (per the redesign handoff) is one icon button — not a 3-way segmented
 * control. System-awareness comes for free from the provider's
 * `defaultTheme="system"`; the button then sets an explicit choice.
 */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes mount swap (single transition, intentional)
    setMounted(true);
  }, []);
  const isDark = resolvedTheme === "dark";
  // Render the moon (the SSR-stable default) until mounted to avoid a
  // hydration flash, then swap to the live icon.
  const Icon = mounted && isDark ? Sun : Moon;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon width={16} height={16} strokeWidth={1.7} />
    </button>
  );
}

/**
 * The shared marketing header — wordmark, primary nav, Sign in + Get
 * started, and the theme toggle. Used by the landing, pricing, privacy,
 * and help pages so there's exactly one navbar in the codebase.
 *
 * `variant="landing"` swaps the Features/Pricing entries for in-page
 * anchors; every other page uses real routes.
 */
export function SiteHeader({ variant }: { variant?: "landing" }) {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand" aria-label="eeatly home">
          <Wordmark size={26} />
        </Link>
        <nav className="topnav-links">
          {PRIMARY_NAV.map((item) => {
            const href =
              variant === "landing" && item.landingHref ? item.landingHref : item.href;
            return (
              <Link key={item.label} href={href as Route}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="topnav-actions">
          <Link href={"/sign-in" as Route}>Sign in</Link>
          <Link href={"/sign-up" as Route} className="btn btn-primary">
            Get started
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
