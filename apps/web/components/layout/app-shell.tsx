"use client";

import * as React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarInset,
  SidebarProvider
} from "@/components/ui/sidebar";
import { BreadcrumbLabelProvider } from "@/components/breadcrumb-label-provider";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import { TabletRailEnforcer } from "@/components/layout/tablet-rail-enforcer";
import { TopBar } from "@/components/layout/top-bar";
import { TopBarActionsProvider } from "@/components/layout/top-bar-actions";
import { QuickLogProvider } from "@/components/dashboard/quick-log-provider";
import { TourHelpProvider } from "@/components/tour/tour-help-provider";
import type { AppUser } from "@/lib/auth/session";

/**
 * Round 26 — dashboard app shell.
 *
 * Outer layers (provider order matters):
 *   TooltipProvider → BreadcrumbLabelProvider (carried from R23 for
 *   any caller that still uses dynamic labels) → SidebarProvider →
 *   TopBarActionsProvider → QuickLogProvider → SidebarInset
 *
 * The SidebarInset hosts the new TopBar (sticky 64px) and the main
 * column. The bottom tab bar is preserved for narrow-viewport
 * navigation (it disappears at md+ where the sidebar shows).
 *
 * `householdLabel` from R23's shell was a small "shared with N
 * members" indicator next to the header bell. It's been folded into
 * the sidebar footer's user card area in a future round; for R26 we
 * drop the chip rather than render a half-migrated header. Bell
 * functionality is unchanged.
 *
 * Keyboard shortcuts have been removed app-wide (mouse/tap-first product).
 * The command palette is still mounted; it opens from the TopBar search
 * button rather than a key combo.
 */

export function AppShell({
  user,
  children
}: {
  user: AppUser;
  /** R23 prop preserved for source compatibility with the old call
   *  site — currently unused, see header doc comment. */
  householdLabel?: string | null;
  children: React.ReactNode;
}) {
  // Keyboard shortcuts (⌘K palette, ⌘E log, G-go navigation) were removed
  // — the app is mouse/tap-first. The command palette is still available
  // via the TopBar search button (it just isn't bound to a key).
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  return (
    <TooltipProvider>
      <BreadcrumbLabelProvider>
        <SidebarProvider defaultOpen>
          <TopBarActionsProvider>
            <BreadcrumbProvider>
            <QuickLogProvider>
              <TourHelpProvider>
                <TabletRailEnforcer />
                <AppSidebar user={user} />
                <SidebarInset>
                  <TopBar onOpenSearch={() => setPaletteOpen(true)} />
                  <main
                    id="main"
                    tabIndex={-1}
                    className="flex-1 px-8 py-7 pb-20 max-md:px-4 max-md:py-5 max-md:pb-28"
                  >
                    {children}
                  </main>
                  <BottomTabBar />
                </SidebarInset>
                <CommandPalette
                  open={paletteOpen}
                  onOpenChange={setPaletteOpen}
                />
              </TourHelpProvider>
            </QuickLogProvider>
            </BreadcrumbProvider>
          </TopBarActionsProvider>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
