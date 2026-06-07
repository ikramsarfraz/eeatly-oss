"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, Plus, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";

type TabItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  match: (path: string) => boolean;
};

const tabs: TabItem[] = [
  { href: "/home", label: "Home", icon: Home, match: (p) => p === "/home" },
  { href: "/plans", label: "Plans", icon: CalendarDays, match: (p) => p.startsWith("/plans") },
  {
    href: "/library",
    label: "Library",
    icon: BookOpen,
    // Library stays active on the recipe-detail subtree.
    match: (p) => p.startsWith("/library") || p.startsWith("/meal")
  },
  { href: "/kitchen", label: "Members", icon: UserPlus, match: (p) => p.startsWith("/kitchen") }
];

/**
 * Mobile-web bottom tab bar — the single nav used on every dashboard route:
 * Home · Plans · Library · Members, with a **corner FAB** ("+" → Log a meal)
 * floating bottom-right above the bar (matches the design's `.fab`). Primary
 * nav beyond these four (search / notifications / settings) lives behind the
 * app-bar hamburger + the avatar's Account sheet. Hidden at `md+`.
 */
export function BottomTabBar() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-[color:var(--surface)] px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
      >
        {tabs.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={tab.match(pathname)} />
        ))}
      </nav>

      {/* Corner FAB — "Log a meal". 56×56 rounded-square forest button, floating
          bottom-right above the bar (design `.fab`: radius 18, deep shadow). */}
      <Link
        href={"/add" as Route}
        aria-label="Log a meal"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_10px_24px_-8px_rgba(46,87,57,0.6)] active:scale-95 md:hidden"
      >
        <Plus className="h-[26px] w-[26px]" strokeWidth={2} />
      </Link>
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
