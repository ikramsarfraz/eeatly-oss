"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  Flag,
  Mail,
  MessageSquare,
  Users,
  Zap,
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
import type { AppUser } from "@/lib/auth/session";

type NavItem = { href: Route; label: string; icon: LucideIcon };

const adminNav: NavItem[] = [
  { href: "/admin/analytics" as Route, label: "Analytics", icon: BarChart3 },
  { href: "/admin/ai-usage" as Route, label: "AI usage", icon: Zap },
  { href: "/admin/billing" as Route, label: "Billing", icon: CreditCard },
  { href: "/admin/users" as Route, label: "Users", icon: Users },
  { href: "/admin/feedback" as Route, label: "Feedback", icon: MessageSquare },
  { href: "/admin/emails" as Route, label: "Email", icon: Mail },
  { href: "/admin/features" as Route, label: "Features", icon: Flag }
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

type AdminSidebarProps = React.ComponentProps<typeof Sidebar> & { user: AppUser };

export function AdminSidebar({ user, ...props }: AdminSidebarProps) {
  const pathname = usePathname() ?? "";

  // "Switch to app" must cross from the admin host (admin.<root>) back to the
  // root app origin — a relative /home would resolve on the admin host, where
  // the proxy bounces every non-admin path back to /admin. Prefer the root
  // origin from NEXT_PUBLIC_APP_URL; fall back to stripping the `admin.` label
  // off the current host. Plain <a> so it's a full cross-host navigation (the
  // shared cross-subdomain cookie carries the session).
  const appOrigin =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") ||
    (typeof window !== "undefined"
      ? window.location.origin.replace(/\/\/admin\./, "//")
      : "");
  const switchToAppHref = `${appOrigin}/home`;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-3 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={"/admin/analytics" as Route}>
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
                    className="truncate font-mono text-[10px] uppercase text-muted-foreground"
                    style={{ letterSpacing: "0.14em" }}
                  >
                    Platform admin
                  </span>
                </div>
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
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(pathname, item.href)}>
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
          {/* Jump back to the cooking app on the root host (same session via
              the shared cross-subdomain cookie). Plain <a> for a full
              cross-host navigation off the admin subdomain. */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href={switchToAppHref}>
                <ArrowLeftRight className="size-4" />
                <span>Switch to app</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
