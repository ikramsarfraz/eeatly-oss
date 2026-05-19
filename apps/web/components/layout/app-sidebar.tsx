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
  Sparkles,
  Users,
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
  /**
   * R29 — optional explicit active-path list. When set, the item is
   * active only when `pathname` exactly matches one of these. Used by
   * the Capture group so "Add a meal" highlights on `/add` + `/add/log`
   * but NOT on `/add/ai` (the latter has its own sibling nav item).
   * Without this, the default `isActiveRoute` helper would match
   * "Add a meal" on every `/add/*` route via its prefix rule and both
   * Capture items would light up at the same time.
   */
  matchPaths?: ReadonlyArray<string>;
};

const cookNav: NavItem[] = [
  { href: "/dashboard" as Route, label: "Home", icon: Home },
  { href: "/plans" as Route, label: "Plans", icon: CalendarDays },
  // The existing `/history` route is the Library — same page, named
  // for the dashboard nav. Don't add a second History item; one route,
  // one nav entry.
  { href: "/history" as Route, label: "Library", icon: BookOpen }
];

/**
 * R29 — Capture group reinstated. R26 omitted it because the routes
 * didn't exist; R29 builds `/add` + `/add/log` + `/add/ai` and brings
 * the group back. "Saved links" stays omitted (no `/saved` route).
 */
const captureNav: NavItem[] = [
  {
    href: "/add" as Route,
    label: "Add a meal",
    icon: Plus,
    matchPaths: ["/add", "/add/log"]
  },
  {
    href: "/add/ai" as Route,
    label: "Capture with AI",
    icon: Sparkles,
    matchPaths: ["/add/ai"]
  }
];

/**
 * R31 — Kitchen group reinstated. "Members" lands at `/household`
 * (the new dedicated kitchen page). Existing "Settings" stays below.
 */
const kitchenNav: NavItem[] = [
  { href: "/household" as Route, label: "Members", icon: Users },
  { href: "/settings" as Route, label: "Settings", icon: Settings }
];

function itemActive(pathname: string, item: NavItem): boolean {
  if (item.matchPaths) return item.matchPaths.includes(pathname);
  return isActiveRoute(pathname, item.href);
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AppUser;
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname() ?? "";

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

        {/* R29 — Log-a-meal CTA now routes to the dedicated
            `/add/log` page. R26 had this opening the existing
            `<QuickLogDialog>` because no route existed; that dialog
            is kept in place (still callable via ⌘E via
            QuickLogProvider) for in-context use, but the sidebar
            primary entry is now the editorial page. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="bg-foreground text-background hover:bg-[#2a3431] hover:text-background active:bg-[#2a3431] active:text-background dark:hover:bg-[color:var(--ink-2,#a8a28f)] dark:active:bg-[color:var(--ink-2,#a8a28f)]"
            >
              <Link href={"/add/log" as Route}>
                <Plus className="h-4 w-4 shrink-0" />
                <span>Log a meal</span>
                <span
                  className="ml-auto rounded bg-white/[0.06] px-[5px] py-px font-mono-brand text-[10.5px] text-[#b8c4be] dark:bg-black/10 dark:text-[#4a463a]"
                  aria-hidden
                >
                  ⌘E
                </span>
              </Link>
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
                      isActive={itemActive(pathname, item)}
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

        {/* R29 — Capture group reinstated. Routes built in this
            round; matchPaths in NavItem disambiguates which item
            highlights for which `/add/*` route. */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel
            className="font-mono uppercase"
            style={{ letterSpacing: "0.14em" }}
          >
            Capture
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {captureNav.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={itemActive(pathname, item)}
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
                      isActive={itemActive(pathname, item)}
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
