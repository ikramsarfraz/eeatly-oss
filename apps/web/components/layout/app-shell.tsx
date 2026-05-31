"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

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
 * ⌘K keyboard shortcut:
 *   Single global listener at the layout level toggles the command
 *   palette. Checked against `metaKey || ctrlKey` so the shortcut
 *   works on macOS and other platforms. The listener no-ops when
 *   focus is inside an input/textarea/contenteditable so typing "k"
 *   into the search bar doesn't bounce the dialog closed.
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
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const router = useRouter();

  // Go-to navigation shortcuts — press `G` then a key. These are the
  // shortcuts advertised on the /add hub. We use a leading-key sequence
  // (GitHub / Linear style) rather than ⌘-combos because the obvious
  // ones (⌘N new window, ⌘L address bar, ⌘P print) are reserved by the
  // browser and either can't be intercepted or would be hostile to
  // hijack. Sequences are browser-safe and all of them work.
  //   G L → log a meal · G A → capture with AI · G U → save a link
  //   G P → plan an occasion · G I → invite (settings)
  //   G H → home · G B → library (browse)
  React.useEffect(() => {
    const GO_TO: Record<string, Route> = {
      l: "/add/log" as Route,
      a: "/add/ai" as Route,
      u: "/add/ai" as Route,
      p: "/plans/new" as Route,
      i: "/settings" as Route,
      h: "/dashboard" as Route,
      b: "/history" as Route
    };
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function isEditable(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }
    function onKeyDown(event: KeyboardEvent) {
      // Modifier combos belong to other handlers (⌘K, ⌘E) / the browser.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        armed = false;
        return;
      }
      if (isEditable(event.target)) return;
      const key = event.key.toLowerCase();
      if (!armed) {
        if (key === "g") {
          armed = true;
          if (timer) clearTimeout(timer);
          // Drop the prefix if no follow-up key lands shortly.
          timer = setTimeout(() => {
            armed = false;
          }, 1500);
        }
        return;
      }
      // Prefix is armed — this key is the destination.
      armed = false;
      if (timer) clearTimeout(timer);
      const dest = GO_TO[key];
      if (dest) {
        event.preventDefault();
        router.push(dest);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  // Global ⌘K listener. Single source of truth; the TopBar's search
  // button calls the same setter.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.shiftKey &&
        !event.altKey;
      if (!isShortcut) return;

      // Skip when focus is inside an editable surface — typing K
      // into the actual search input should not re-toggle. The
      // dialog itself uses cmdk's keyboard handling, which already
      // suppresses native shortcuts when its input has focus, but
      // we still guard so a stray ⌘K outside the dialog doesn't
      // bounce while the user is mid-text.
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target.isContentEditable
        ) {
          // Allow ⌘K to still open the palette from an input — it's
          // the most common entry point. The only reason to skip would
          // be if we're already inside the palette, which `paletteOpen`
          // tracks. If open, let cmdk handle the key.
          if (paletteOpen) return;
        }
      }

      event.preventDefault();
      setPaletteOpen((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen]);

  return (
    <TooltipProvider>
      <BreadcrumbLabelProvider>
        <SidebarProvider defaultOpen>
          <TopBarActionsProvider>
            <BreadcrumbProvider>
            <QuickLogProvider>
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
            </QuickLogProvider>
            </BreadcrumbProvider>
          </TopBarActionsProvider>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
