"use client";

import * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
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
        <div className="relative flex w-full flex-1 flex-col bg-background">
          {/* Narrow-viewport top strip: the sidebar collapses off-canvas, so
              expose a trigger to bring it back. Hidden at md+ where the rail
              is permanent. */}
          <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-4 md:hidden">
            <SidebarTrigger />
            <span
              className="font-mono text-[11px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              Platform admin
            </span>
          </div>
          {children}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
