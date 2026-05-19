"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  BookOpen,
  CalendarDays,
  Home,
  Plus,
  Settings,
  type LucideIcon
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";
import { useQuickLog } from "@/components/dashboard/quick-log-provider";
import { UserMenu } from "@/components/layout/user-menu";
import { isActiveRoute } from "@/lib/nav/breadcrumbs";
import type { AppUser } from "@/lib/auth/session";

/**
 * Round 26 — App sidebar composed from shadcn primitives.
 *
 * The design's visual is a fixed 248px cream rail with three named
 * groups (Cook / Capture / Kitchen) and a brand block + Log-a-meal
 * CTA in the header. shadcn's `Sidebar` already handles every
 * structural concern (keyboard nav, focus management, mobile Sheet
 * wrapping, the collapsible state machine), so this file just maps
 * the design content onto the primitive's slots and tunes the chrome
 * via CSS variables in `globals.css`.
 *
 * Sidebar collapse mode:
 *   The spec calls for `collapsible="none"` but shadcn's `none` mode
 *   skips the mobile Sheet behavior entirely (always-rendered static
 *   div). `collapsible="offcanvas"` keeps the Sheet on mobile, and
 *   we pair it with `defaultOpen` on the provider so desktop reads
 *   the panel as "permanent" (which is what the design intends).
 *   The off-canvas toggle button is rendered in `TopBar` only on
 *   narrow viewports — desktop never sees it.
 *
 * Nav items currently omitted (spec-listed but no route exists):
 *   - Add a meal `/add` → no route. The sidebar header's "Log a meal"
 *     CTA opens the existing `QuickLogDialog` instead.
 *   - Capture with AI `/add/ai` → no route. Inline AI is in
 *     `AISuggestDialog`, opened from the meal log form.
 *   - Saved links `/saved` → no route.
 *   - History `/history` is the Library route; no separate page.
 *   - Members `/household` → no route. Household lives inside
 *     `/settings`.
 */

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

const cookNav: NavItem[] = [
  { href: "/dashboard" as Route, label: "Home", icon: Home },
  { href: "/plans" as Route, label: "Plans", icon: CalendarDays },
  // The existing `/history` route is the Library — same page, named
  // for the dashboard nav. Don't add a second History item; one route,
  // one nav entry.
  { href: "/history" as Route, label: "Library", icon: BookOpen }
];

const kitchenNav: NavItem[] = [
  { href: "/settings" as Route, label: "Settings", icon: Settings }
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AppUser;
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname() ?? "";
  const { open: openQuickLog } = useQuickLog();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-3 pt-4">
        {/* Brand block — squircle monogram + serif wordmark + mono
            caption. The Link routes to /dashboard so tapping the
            brand returns Home from any deep route. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={"/dashboard" as Route}>
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary font-serif italic text-[22px] leading-none text-primary-foreground"
                >
                  e
                </span>
                <div className="grid flex-1 text-left leading-tight">
                  <span
                    className="truncate font-serif text-[22px] leading-none text-sidebar-foreground"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    eeatly
                  </span>
                  <span
                    className="mt-1 truncate font-mono text-[10px] uppercase text-muted-foreground"
                    style={{ letterSpacing: "0.14em" }}
                  >
                    private beta
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Log-a-meal CTA — opens the existing QuickLogDialog (R23+).
            The `/add/log` route from the spec doesn't exist yet; the
            in-flight dialog is the actual logging surface. ⌘E mirrors
            the existing keyboard shortcut wired in QuickLogProvider. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={openQuickLog}
              aria-haspopup="dialog"
              className="bg-foreground text-background hover:bg-[#2a3431] hover:text-background active:bg-[#2a3431] active:text-background dark:hover:bg-[color:var(--ink-2,#a8a28f)] dark:active:bg-[color:var(--ink-2,#a8a28f)]"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Log a meal</span>
              <span
                className="ml-auto rounded bg-white/[0.06] px-[5px] py-px font-mono-brand text-[10.5px] text-[#b8c4be] dark:bg-black/10 dark:text-[#4a463a]"
                aria-hidden
              >
                ⌘E
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarGroupLabel
            className="font-mono uppercase"
            style={{ letterSpacing: "0.14em" }}
          >
            Cook
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cookNav.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveRoute(pathname, item.href)}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Capture group omitted — the /add/* routes don't exist
            yet (see header doc comment). When they land, add a
            `<SidebarGroup>` with the same shape as Cook. */}

        <SidebarGroup className="py-1">
          <SidebarGroupLabel
            className="font-mono uppercase"
            style={{ letterSpacing: "0.14em" }}
          >
            Kitchen
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {kitchenNav.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveRoute(pathname, item.href)}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
