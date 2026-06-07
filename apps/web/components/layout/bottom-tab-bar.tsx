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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; fill?: string }>;
  filled?: boolean;
  match: (path: string) => boolean;
};

const tabs: TabItem[] = [
  { href: "/home", label: "Home", icon: Home, filled: true, match: (p) => p === "/home" },
  {
    href: "/library",
    label: "Library",
    icon: BookOpen,
    filled: true,
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
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(74px+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <TabLink tab={tabs[0]} active={tabs[0].match(pathname)} />
        <TabLink tab={tabs[1]} active={tabs[1].match(pathname)} />

        {/* Center-docked FAB — "Log a meal". 54×54 forest circle, overlapping
            the bar's top edge by 22px. */}
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
          className="flex flex-1 flex-col items-center justify-center gap-1 pt-2 text-[10.5px] font-medium text-[color:var(--ink3)]"
        >
          <Menu className="h-[23px] w-[23px]" strokeWidth={2} />
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
        "flex flex-1 flex-col items-center justify-center gap-1 pt-2 text-[10.5px]",
        active ? "font-semibold text-primary" : "font-medium text-[color:var(--ink3)]"
      )}
    >
      <Icon
        className="h-[23px] w-[23px]"
        strokeWidth={2}
        fill={active && tab.filled ? "currentColor" : "none"}
      />
      {tab.label}
    </Link>
  );
}
