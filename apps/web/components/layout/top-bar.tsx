"use client";

import * as React from "react";
import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Search } from "lucide-react";

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
import { useTourHelp } from "@/components/tour/tour-help-provider";
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
  const pathname = usePathname() ?? "/home";
  // R30 — pages can register a runtime override for a placeholder
  // crumb label (e.g. Recipe Detail → meal name; Plan Detail → plan
  // name). When the override carries a `targetLabel`, the matching
  // crumb anywhere in the trail is replaced — useful on deeper
  // refine routes where the dynamic segment isn't the last crumb.
  // Without `targetLabel`, only the last crumb is replaced (R28's
  // simple contract).
  const breadcrumbOverride = useBreadcrumbOverride();
  const staticCrumbs = getCrumbs(pathname);
  const crumbs = (() => {
    if (!breadcrumbOverride || staticCrumbs.length === 0) return staticCrumbs;
    if (breadcrumbOverride.targetLabel) {
      let replaced = false;
      return staticCrumbs.map((c) => {
        if (!replaced && c.label === breadcrumbOverride.targetLabel) {
          replaced = true;
          return { ...c, label: breadcrumbOverride.label };
        }
        return c;
      });
    }
    return staticCrumbs.map((c, i) =>
      i === staticCrumbs.length - 1
        ? { ...c, label: breadcrumbOverride.label }
        : c
    );
  })();
  const actions = useTopBarActions();
  const { openHelp } = useTourHelp();

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
          data-tour="search"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="hidden h-9 w-[280px] cursor-pointer items-center gap-2 rounded-md border bg-[var(--surface-2)] px-3 text-left text-[13px] text-muted-foreground transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex lg:w-[320px]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">
            Search meals, plans, ingredients…
          </span>
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

        {/* Help: opens the guides slide-over (and a "replay tour" entry). */}
        <button
          type="button"
          data-tour="help-btn"
          onClick={openHelp}
          aria-label="Help and guides"
          className="flex h-9 w-9 items-center justify-center rounded-md border bg-[var(--surface-2)] text-muted-foreground transition-colors hover:bg-[var(--surface)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>

        {actions}
      </div>
    </header>
  );
}
