"use client";

import Link from "next/link";
import type { Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import { PRIMARY_NAV } from "@/lib/marketing-nav";

/**
 * The shared marketing header — wordmark, primary nav, Sign in + Get
 * started. Used by the landing, pricing, privacy, and help pages so there's
 * exactly one navbar in the codebase. These pages are always presented in
 * light mode (see `ForceLightTheme`), so there's no theme toggle here.
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
            Try eeatly
          </Link>
        </div>
      </div>
    </header>
  );
}
