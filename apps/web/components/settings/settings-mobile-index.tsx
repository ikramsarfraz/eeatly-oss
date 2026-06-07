"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTheme } from "next-themes";
import {
  Bell,
  ChevronRight,
  Settings2,
  Share2,
  ShieldAlert,
  Sparkles,
  Sun,
  UserRound,
  Users
} from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

type Row = {
  key: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
};

const GROUPS: { label: string; rows: Row[] }[] = [
  {
    label: "Account & kitchen",
    rows: [
      { key: "account", label: "Account", sub: "Name & the email you sign in with", icon: UserRound },
      { key: "plan", label: "Plan", sub: "Your subscription & billing", icon: Sparkles },
      { key: "sharing", label: "Sharing & privacy", sub: "Who can find & reshare your recipes", icon: Share2 },
      { key: "kitchen", label: "Kitchen", sub: "Members & invitations", icon: Users }
    ]
  },
  {
    label: "App",
    rows: [
      { key: "notifications", label: "Notifications", sub: "Nudges & weekly recaps", icon: Bell },
      { key: "appearance", label: "Appearance", sub: "Theme & display", icon: Sun },
      { key: "advanced", label: "Advanced", sub: "Developer & data controls", icon: Settings2 }
    ]
  }
];

const DANGER_ROW: Row = {
  key: "danger",
  label: "Danger zone",
  sub: "Delete your account",
  icon: ShieldAlert,
  danger: true
};

/** Status pill (wheat/sage) and count badge for the right side of a row. */
function Pill({ children, tone }: { children: React.ReactNode; tone: "sage" | "wheat" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "wheat"
          ? "bg-[color:var(--wheat-soft,#f4eedb)] text-[color:var(--wheat-fg,#6f571e)]"
          : "bg-[color:var(--sage-soft)] text-primary"
      )}
    >
      {children}
    </span>
  );
}

/**
 * R37 — mobile Settings index. A grouped, card-based drill-down menu (replaces
 * the flat desktop nav squished onto mobile). Each row links into its section
 * (`/settings/<key>`); the index shows no section body on mobile. Desktop keeps
 * the two-pane layout (this is `md:hidden`).
 */
export function SettingsMobileIndex({
  userName,
  version,
  planLabel
}: {
  userName: string | null;
  version: string;
  planLabel?: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // Defer so the first paint matches SSR (theme is unknown server-side); the
  // timeout keeps the setState out of the effect body (set-state-in-effect lint).
  React.useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const notifications = trpc.notifications.list.useQuery({ limit: 1 }, { staleTime: 60_000 });
  const unread = notifications.data?.unreadCount ?? 0;

  const right = (key: string): React.ReactNode => {
    switch (key) {
      case "account":
        return userName ? <Value>{userName}</Value> : null;
      case "plan":
        return planLabel ? <Pill tone="wheat">{planLabel}</Pill> : null;
      case "appearance":
        return mounted ? <Pill tone="sage">{resolvedTheme === "dark" ? "Dark" : "Light"}</Pill> : null;
      case "notifications":
        return unread > 0 ? (
          <span className="min-w-[20px] rounded-full bg-[color:var(--accent)] px-1.5 text-center font-mono text-[11px] font-semibold text-[color:var(--accent-foreground,#fff)]">
            {unread}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="md:hidden">
      {/* Hero */}
      <div className="px-1 pb-4 pt-1">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
          eeatly · v{version}
        </div>
        <h1 className="mt-1 font-serif text-[44px] leading-none tracking-[-0.02em] text-foreground">Settings.</h1>
      </div>

      <div className="grid gap-6">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
              {group.label}
            </div>
            <Card>
              {group.rows.map((row, i) => (
                <SettingsIndexRow key={row.key} row={row} right={right(row.key)} last={i === group.rows.length - 1} />
              ))}
            </Card>
          </section>
        ))}

        <Card>
          <SettingsIndexRow row={DANGER_ROW} right={null} last />
        </Card>
      </div>
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{children}</span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-card">
      <div className="divide-y divide-[color:var(--border-soft,var(--border))]">{children}</div>
    </div>
  );
}

function SettingsIndexRow({ row, right, last }: { row: Row; right: React.ReactNode; last: boolean }) {
  const Icon = row.icon;
  return (
    <Link
      href={`/settings/${row.key}` as Route}
      className={cn("flex items-center gap-3 px-3.5 py-3 active:bg-[color:var(--surface-2)]", last && "")}
    >
      <span
        className={cn(
          "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]",
          row.danger ? "bg-[color:var(--danger-soft)] text-[color:var(--danger-fg)]" : "bg-[color:var(--sage-soft)] text-primary"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[14.5px] font-semibold leading-tight",
            row.danger ? "text-[color:var(--danger-fg)]" : "text-foreground"
          )}
        >
          {row.label}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{row.sub}</span>
      </span>
      {right}
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--ink4)]" />
    </Link>
  );
}
