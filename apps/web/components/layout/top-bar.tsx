"use client";

import * as React from "react";
import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

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
import { NotificationBell } from "@/components/layout/notification-bell";
import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";
import { useTopBarActions } from "@/components/layout/top-bar-actions";
import { getCrumbs } from "@/lib/nav/breadcrumbs";

/**
 * Round 26 — top bar for the new app shell.
 *
 * Composition:
 *   1. Left cluster — `SidebarTrigger` (mobile only, opens the
 *      shadcn Sheet), divider, breadcrumb.
 *   2. Spacer.
 *   3. Search trigger — a styled button that opens the global
 *      `CommandPalette`. ⌘K hint pill on the right of the trigger.
 *   4. `NotificationBell` (relocated from the old header).
 *   5. Per-page right actions — pulled from `useTopBarActions()`.
 *      Pages register via `useSetTopBarActions(node)` from
 *      `top-bar-actions.tsx`.
 *
 * The bar is sticky at the top of `<SidebarInset>` so it stays in
 * view while the main column scrolls. `backdrop-blur` on the
 * background-mixed surface keeps it legible over the editorial
 * hero gradients on Home.
 *
 * The search trigger is the source of truth for "open the command
 * palette via mouse". The keyboard shortcut lives in the layout
 * (one global listener instead of multiple).
 */

type TopBarProps = {
  onOpenSearch: () => void;
};

export function TopBar({ onOpenSearch }: TopBarProps) {
  const pathname = usePathname() ?? "/dashboard";
  // R28 — pages can set a runtime override that replaces the LAST
  // static crumb's label (e.g. Plan Detail → plan name; Recipe Detail
  // → meal name). Intermediate crumbs stay static — "Cook / Library"
  // is structural and doesn't need per-page lookup.
  const breadcrumbOverride = useBreadcrumbOverride();
  const staticCrumbs = getCrumbs(pathname);
  const crumbs =
    breadcrumbOverride && staticCrumbs.length > 0
      ? staticCrumbs.map((c, i) =>
          i === staticCrumbs.length - 1
            ? { ...c, label: breadcrumbOverride }
            : c
        )
      : staticCrumbs;
  const actions = useTopBarActions();

  return (
    <header
      className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-4 backdrop-blur-md sm:px-6"
      data-slot="top-bar"
    >
      {/* SidebarTrigger renders the shadcn icon button. Hidden on md+
          because the sidebar is permanently visible there; visible
          below md so the user can summon the Sheet. */}
      <SidebarTrigger className="-ml-1 md:hidden" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-1 h-4 md:hidden" />

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

      <div className="ml-auto flex items-center gap-2">
        {/* Search trigger — styled like a flat input bar. The actual
            input lives inside the command dialog; this is just a
            keyboard-accessible button that opens it. ⌘K pill on the
            right cues the shortcut. */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="hidden h-9 w-[280px] cursor-pointer items-center gap-2 rounded-md border bg-[var(--surface-2)] px-3 text-left text-[13px] text-muted-foreground transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex lg:w-[320px]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">
            Search meals, plans, ingredients…
          </span>
          <kbd
            className="ml-auto rounded border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground"
            aria-hidden
          >
            ⌘K
          </kbd>
        </button>
        {/* Mobile-only — icon-only search trigger when the full bar
            is too wide. */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-[var(--surface-2)] text-muted-foreground transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        >
          <Search className="h-4 w-4" />
        </button>

        <NotificationBell />

        {actions}
      </div>
    </header>
  );
}
