"use client";

import * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbLabelProvider } from "@/components/breadcrumb-label-provider";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { QuickLogDialog } from "@/components/dashboard/quick-log-dialog";
import type { AppUser } from "@/lib/auth/session";

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const [quickLogOpen, setQuickLogOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "e" && event.key !== "E") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      setQuickLogOpen((open) => !open);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <AppSidebar user={user} />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <AppBreadcrumb />
            </header>
            <main className="flex-1 px-8 py-7 pb-20 max-md:px-4 max-md:py-5 max-md:pb-28">
              {children}
            </main>
            <BottomTabBar />
            <QuickLogDialog open={quickLogOpen} onOpenChange={setQuickLogOpen} />
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
