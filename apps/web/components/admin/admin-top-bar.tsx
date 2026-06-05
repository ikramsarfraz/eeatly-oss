"use client";

import * as React from "react";
import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Sticky top bar for the platform-admin surface: a sidebar toggle (so the rail
 * can be collapsed to reclaim width) plus a breadcrumb trail derived from the
 * pathname. Mirrors the app TopBar's look, minus search/notifications which
 * don't apply to admin.
 */

const SECTION_LABELS: Record<string, string> = {
  analytics: "Analytics",
  "ai-usage": "AI usage",
  billing: "Billing",
  users: "Users",
  feedback: "Feedback",
  emails: "Email",
  features: "Features"
};

function titleCase(seg: string): string {
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Crumb = { label: string; href?: Route };

function adminCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean); // ["admin", section, …]
  const crumbs: Crumb[] = [{ label: "Admin", href: "/admin/analytics" as Route }];

  if (parts.length >= 2) {
    const section = parts[1];
    const label = SECTION_LABELS[section] ?? titleCase(section);
    // Link the section crumb only when it isn't the last one.
    crumbs.push({
      label,
      href: parts.length > 2 ? (`/admin/${section}` as Route) : undefined
    });
  }

  // Deeper dynamic segments (e.g. /admin/features/[feature]) render as plain
  // labels at the tail.
  for (let i = 2; i < parts.length; i++) {
    crumbs.push({ label: titleCase(decodeURIComponent(parts[i])) });
  }

  return crumbs;
}

export function AdminTopBar() {
  const pathname = usePathname() ?? "/admin/analytics";
  const crumbs = adminCrumbs(pathname);

  return (
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-4 backdrop-blur-md"
      data-slot="admin-top-bar"
    >
      <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${idx}`}>
                <BreadcrumbItem>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="font-mono text-[11.5px] uppercase tracking-[0.14em]">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={crumb.href}
                        className="font-mono text-[11.5px] uppercase tracking-[0.14em]"
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast ? <BreadcrumbSeparator /> : null}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
