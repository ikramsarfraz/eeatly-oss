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
import type { AppUser } from "@/lib/auth/session";

export function AppShell({
  user,
  canWrite,
  children,
}: {
  user: AppUser;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <AppSidebar user={user} canWrite={canWrite} />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <AppBreadcrumb />
            </header>
            <main className="flex-1 px-8 py-7 pb-20 max-md:px-4 max-md:py-5">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
