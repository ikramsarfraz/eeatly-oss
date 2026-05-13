"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Clock3, Menu, Moon, Plus, Sparkles } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { useQuickLog } from "@/components/dashboard/quick-log-provider";
import { cn } from "@/lib/utils";

type TabItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  match: (path: string) => boolean;
};

const tabs: TabItem[] = [
  {
    href: "/dashboard",
    label: "Tonight",
    icon: Moon,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/history",
    label: "History",
    icon: Clock3,
    match: (p) => p.startsWith("/history"),
  },
  {
    href: "/dashboard#ideas" as Route,
    label: "Ideas",
    icon: Sparkles,
    match: () => false,
  },
];

export function BottomTabBar() {
  const pathname = usePathname() ?? "";
  const { toggleSidebar } = useSidebar();
  const { open: openQuickLog } = useQuickLog();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 grid grid-cols-5 gap-1 border-t bg-[color-mix(in_oklab,var(--background)_96%,transparent)] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden"
    >
      {tabs.slice(0, 2).map((tab) => (
        <TabLink key={tab.label} tab={tab} active={tab.match(pathname)} />
      ))}

      <button
        type="button"
        aria-label="Log a meal"
        aria-haspopup="dialog"
        onClick={openQuickLog}
        className="-mt-4 justify-self-center grid h-[52px] w-[52px] place-items-center rounded-full border-[3px] border-[var(--background)] bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_rgba(47,111,88,0.6),0_2px_4px_rgba(27,34,32,0.08)] transition-transform active:scale-95"
      >
        <Plus className="h-5 w-5" strokeWidth={2.25} />
      </button>

      <TabLink tab={tabs[2]} active={false} />

      <button
        type="button"
        aria-label="Open menu"
        onClick={toggleSidebar}
        className="flex flex-col items-center gap-[3px] rounded-[9px] py-1.5 text-[10.5px] font-medium text-muted-foreground"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
        <span>More</span>
      </button>
    </nav>
  );
}

function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex flex-col items-center gap-[3px] rounded-[9px] py-1.5 text-[10.5px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span>{tab.label}</span>
    </Link>
  );
}
