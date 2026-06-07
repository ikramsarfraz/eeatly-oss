"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, Menu, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { MobileSheet, MoreSheetContent } from "@/components/mobile/mobile-sheet";

type TabItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  match: (path: string) => boolean;
};

const tabs: TabItem[] = [
  { href: "/home", label: "Home", icon: Home, match: (p) => p === "/home" },
  {
    href: "/library",
    label: "Library",
    icon: BookOpen,
    // Library stays active on the recipe-detail subtree.
    match: (p) => p.startsWith("/library") || p.startsWith("/meal")
  },
  {
    href: "/plans",
    label: "Plans",
    icon: CalendarDays,
    match: (p) => p.startsWith("/plans")
  }
];

/**
 * R35/R37 mobile-web bottom tab bar — the single nav used on every dashboard
 * route: Home · Library · center-docked "+" FAB · Plans · More.
 * The **center FAB is the app's primary verb**: it links straight to "Log a
 * meal" (`/add`). More opens the More sheet (members / search / notifications /
 * settings / theme toggle); account access lives on the app-bar avatar, not
 * here. Hidden at `md+` (desktop sidebar).
 */
export function BottomTabBar() {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-[color:var(--surface)] px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
      >
        <TabLink tab={tabs[0]} active={tabs[0].match(pathname)} />
        <TabLink tab={tabs[1]} active={tabs[1].match(pathname)} />

        {/* Center-docked FAB — "Log a meal". 54×54 forest circle, overlapping
            the bar's top edge by 22px (matches the design's `.tab-fab`). */}
        <div className="relative flex flex-1 justify-center">
          <Link
            href={"/add" as Route}
            aria-label="Log a meal"
            className="absolute -top-[22px] flex h-[54px] w-[54px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(46,87,57,0.35)] active:scale-95"
          >
            <Plus className="h-[25px] w-[25px]" strokeWidth={2.2} />
          </Link>
        </div>

        <TabLink tab={tabs[2]} active={tabs[2].match(pathname)} />

        <button
          type="button"
          aria-label="More"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-[3px] px-0 py-1.5 text-[10px] font-semibold tracking-[0.1px] text-[color:var(--ink3)]"
        >
          <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
          More
        </button>
      </nav>

      <MobileSheet open={moreOpen} label="More" onClose={() => setMoreOpen(false)}>
        <MoreSheetContent onClose={() => setMoreOpen(false)} />
      </MobileSheet>
    </>
  );
}

function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Active state is a colour change only (forest stroke) — the design's
        // `.tab.on` doesn't fill the icon or bump the weight.
        "flex flex-1 flex-col items-center justify-center gap-[3px] py-1.5 text-[10px] font-semibold tracking-[0.1px]",
        active ? "text-primary" : "text-[color:var(--ink3)]"
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
      {tab.label}
    </Link>
  );
}
