"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useTheme } from "next-themes";
import {
  Bell,
  CalendarPlus,
  ChevronRight,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Utensils
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Lightweight bottom sheet (scrim + slide-up cream card + grab handle). */
export function MobileSheet({
  open,
  onClose,
  label,
  children
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden" role="dialog" aria-modal="true">
      <div className="ae-scrim absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="ae-sheet relative rounded-t-[22px] border-t border-border bg-background px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[10px] font-[family-name:var(--font-geist)] shadow-[0_-18px_50px_-12px_rgba(20,20,15,0.4)]">
        <div className="mx-auto mb-[14px] mt-1 h-1 w-10 rounded-full bg-[color:var(--ink4)]" />
        {label && (
          <div className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
            {label}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function SheetRow({
  icon,
  label,
  sub,
  onClick,
  accent,
  danger
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[13px] rounded-xl px-2 py-[13px] text-left active:bg-[color:var(--surface-2)]"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]",
          accent
            ? "bg-secondary text-primary"
            : danger
              ? "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
              : "border border-border bg-card text-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[14.5px] font-semibold tracking-[-0.01em]",
            danger ? "text-[color:var(--danger)]" : "text-foreground"
          )}
        >
          {label}
        </span>
        {sub && <span className="mt-px block truncate text-[12px] text-[color:var(--ink3)]">{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--ink4)]" />
    </button>
  );
}

const ICON = "h-5 w-5";

export function AddSheetContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const go = (href: Route) => {
    onClose();
    router.push(href);
  };
  return (
    <>
      <SheetRow
        accent
        icon={<Utensils className={ICON} />}
        label="Add a meal"
        sub="Log what you cooked, or capture a recipe"
        onClick={() => go("/add" as Route)}
      />
      <SheetRow
        icon={<Sparkles className={ICON} />}
        label="Capture with AI"
        sub="Photo, voice note or text"
        onClick={() => go("/add?ai=1" as Route)}
      />
      <SheetRow
        icon={<CalendarPlus className={ICON} />}
        label="Plan an occasion"
        sub="Build a menu for a day"
        onClick={() => go("/plans/new" as Route)}
      />
    </>
  );
}

export function MoreSheetContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const go = (href: Route) => {
    onClose();
    router.push(href);
  };
  return (
    <>
      <SheetRow
        icon={<Users className={ICON} />}
        label="Members & sharing"
        sub="Your kitchen"
        onClick={() => go("/kitchen" as Route)}
      />
      <SheetRow
        icon={<Search className={ICON} />}
        label="Search"
        sub="Meals, plans, ingredients"
        onClick={() => go("/search" as Route)}
      />
      <SheetRow
        icon={<Bell className={ICON} />}
        label="Notifications"
        onClick={() => go("/notifications" as Route)}
      />
      <SheetRow icon={<Settings className={ICON} />} label="Settings" onClick={() => go("/settings" as Route)} />
      <div className="my-2 h-px bg-[color:var(--border-soft,var(--border))]" />
      <SheetRow
        accent
        icon={isDark ? <Sun className={ICON} /> : <Moon className={ICON} />}
        label={isDark ? "Switch to light" : "Switch to dark"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      />
    </>
  );
}
