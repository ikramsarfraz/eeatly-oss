"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  BookOpen,
  CalendarDays,
  ChefHat,
  Home,
  Plus,
  Settings,
  Share2,
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
 *   - History `/library` is the Library route; no separate page.
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
  /**
   * Extra route subtrees that also activate this item, matched by prefix
   * (`=== p` or `startsWith(p + '/')`). For nav whose detail pages live
   * under a different path than the list — e.g. Library (`/library`)
   * stays active on recipe pages at `/meal/[id]` and deeper.
   */
  activePrefixes?: ReadonlyArray<string>;
};

const cookNav: NavItem[] = [
  { href: "/home" as Route, label: "Home", icon: Home },
  { href: "/plans" as Route, label: "Plans", icon: CalendarDays },
  // The existing `/library` route is the Library — same page, named
  // for the dashboard nav. Don't add a second History item; one route,
  // one nav entry. Recipe detail lives at `/meal/[id]`, so keep Library
  // active there too.
  { href: "/library" as Route, label: "Library", icon: BookOpen, activePrefixes: ["/meal"] }
];

// Capture consolidation: the old CAPTURE group (Add a meal hub + Capture with
// AI) is gone — the single top "Add a meal" CTA is the only capture door, and
// it opens the unified composer at /add.

/**
 * Sharing group — Kitchen is your household (a shared cooking space; recipes
 * still stay private per-item), People is one-to-one per-item sharing. Both
 * use the default prefix-based active rule, so they highlight on their own
 * nested routes; `/kitchen` and `/people` don't overlap.
 */
const sharingNav: NavItem[] = [
  { href: "/kitchen" as Route, label: "Kitchen", icon: ChefHat },
  { href: "/people" as Route, label: "People", icon: Share2 },
  { href: "/settings" as Route, label: "Settings", icon: Settings }
];

function itemActive(pathname: string, item: NavItem): boolean {
  // `matchPaths` (when set) is an exact-match allowlist used to keep sibling
  // items from double-highlighting; otherwise fall back to the prefix-based
  // `isActiveRoute`. Either way, `activePrefixes` can light the item up on
  // additional subtrees (e.g. Library on `/meal/[id]`).
  const base = item.matchPaths
    ? item.matchPaths.includes(pathname)
    : isActiveRoute(pathname, item.href);
  if (base) return true;
  return (
    item.activePrefixes?.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    ) ?? false
  );
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
              <Link href={"/home" as Route}>
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
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* The single capture door — opens the unified composer at /add
            (the QuickLogDialog stays callable via ⌘E for in-context use). */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="bg-foreground text-background hover:bg-[#2a3431] hover:text-background active:bg-[#2a3431] active:text-background dark:hover:bg-[color:var(--ink-2,#a8a28f)] dark:active:bg-[color:var(--ink-2,#a8a28f)]"
            >
              <Link href={"/add" as Route}>
                <Plus className="h-4 w-4 shrink-0" />
                <span>Add a meal</span>
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


        <SidebarGroup className="py-1">
          <SidebarGroupLabel
            className="font-mono uppercase"
            style={{ letterSpacing: "0.14em" }}
          >
            Sharing
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sharingNav.map((item) => {
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
