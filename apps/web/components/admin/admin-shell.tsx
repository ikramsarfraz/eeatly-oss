"use client";

import * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import type { AppUser } from "@/lib/auth/session";

/**
 * Admin shell — the platform-admin surface now uses the same sidebar chrome as
 * the cooking app (via the shared shadcn Sidebar primitives) instead of a top
 * header navbar. The inset is a plain <div> (not SidebarInset, which is a
 * <main>) so it doesn't nest with each admin page's own <main>.
 */
export function AdminShell({
  user,
  children
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <AdminSidebar user={user} />
        {/* `min-w-0` lets this flex child shrink below its content width — without
            it, responsive charts (recharts ResponsiveContainer on /admin/analytics)
            measure width(-1) and warn/collapse on first render. */}
        <div className="relative flex w-full min-w-0 flex-1 flex-col bg-background">
          {/* Sticky top bar: sidebar toggle + breadcrumbs. The toggle lets the
              rail collapse off-canvas to reclaim width on data-heavy pages. */}
          <AdminTopBar />
          {children}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
