"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  Clock3,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  type LucideIcon,
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { QuickLogDialog } from "@/components/dashboard/quick-log-dialog";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import type { AppUser } from "@/lib/auth/session";

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

const cookingNav: NavItem[] = [
  { href: "/dashboard", label: "Tonight", icon: Moon },
  { href: "/history", label: "History", icon: Clock3 },
];

const youNav: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AppUser;
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="eeatly">
              <Link href="/dashboard">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary font-serif italic text-[22px] leading-none text-primary-foreground">
                  e
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">eeatly</span>
                  <span className="truncate text-xs text-muted-foreground">
                    private beta
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          <SidebarMenuItem>
            <QuickLogDialog
              trigger={
                <SidebarMenuButton
                  className="bg-foreground text-background hover:bg-[#2a3431] hover:text-background active:bg-[#2a3431] active:text-background"
                  tooltip="Log a meal"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Log a meal</span>
                  <span className="ml-auto rounded bg-white/[0.06] px-[5px] py-px font-mono-brand text-[10.5px] text-[#b8c4be] group-data-[collapsible=icon]:hidden">
                    ⌘N
                  </span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>Cooking</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cookingNav.map(item => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      asChild
                      tooltip={item.label}
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
          <SidebarGroupLabel>You</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {youNav.map(item => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      asChild
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <FeedbackDialog
                  trigger={
                    <SidebarMenuButton tooltip="Feedback">
                      <MessageSquare className="size-4" />
                      <span>Feedback</span>
                    </SidebarMenuButton>
                  }
                />
              </SidebarMenuItem>
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
