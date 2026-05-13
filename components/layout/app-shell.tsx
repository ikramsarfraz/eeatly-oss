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
import { TabletRailEnforcer } from "@/components/layout/tablet-rail-enforcer";
import { QuickLogProvider } from "@/components/dashboard/quick-log-provider";
import type { AppUser } from "@/lib/auth/session";

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <QuickLogProvider>
            <TabletRailEnforcer />
            <AppSidebar user={user} />
            <SidebarInset>
              <header className="sticky top-0 z-20 flex h-[60px] shrink-0 items-center gap-2 border-b bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-4 backdrop-blur-md sm:px-6">
                <SidebarTrigger
                  className="-ml-1 md:max-lg:hidden"
                  aria-label="Toggle navigation"
                />
                <Separator orientation="vertical" className="mr-2 h-4 md:max-lg:hidden" />
                <AppBreadcrumb />
              </header>
              <main className="flex-1 px-8 py-7 pb-20 max-md:px-4 max-md:py-5 max-md:pb-28">
                {children}
              </main>
              <BottomTabBar />
            </SidebarInset>
          </QuickLogProvider>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
