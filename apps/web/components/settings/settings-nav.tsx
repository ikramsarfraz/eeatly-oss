"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * R32 — Settings left route-nav. One link per nested settings route;
 * active state derives from the pathname. "Danger zone" is separated by a
 * divider and styled in the danger color. Sticky on lg+ (matches the
 * editorial route-nav in the handoff); static below the single-column
 * breakpoint.
 */
const ROUTES: ReadonlyArray<{ key: string; label: string; danger?: boolean }> = [
  { key: "account", label: "Account" },
  { key: "plan", label: "Plan" },
  { key: "sharing", label: "Sharing & privacy" },
  { key: "kitchen", label: "Kitchen" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "advanced", label: "Advanced" },
  { key: "danger", label: "Danger zone", danger: true }
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="lg:sticky lg:top-[calc(var(--header-h)_+_16px)] lg:self-start"
    >
      <h1
        className="mb-5 font-serif text-[40px] leading-none text-foreground"
        style={{ letterSpacing: "-0.025em" }}
      >
        Settings.
      </h1>
      <ul className="grid gap-1">
        {ROUTES.map((route) => {
          const href = `/settings/${route.key}`;
          const isActive = pathname === href;
          return (
            <li key={route.key} className={route.danger ? "mt-2 border-t border-[var(--border-soft,var(--border))] pt-2" : undefined}>
              <Link
                href={href as Route}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  isActive && !route.danger
                    ? "bg-[color:var(--sage-soft)] font-semibold text-primary"
                    : isActive && route.danger
                      ? "bg-[color:var(--danger-soft)] font-semibold text-[color:var(--danger-fg)]"
                      : route.danger
                        ? "text-[color:var(--danger-fg)] hover:bg-[color:var(--danger-soft)]/60"
                        : "text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground"
                )}
              >
                {route.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
