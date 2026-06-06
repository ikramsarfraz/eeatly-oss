"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * R35 mobile-web — shared screen scaffold + header.
 *
 * Each redesigned mobile screen renders inside `<MobileScaffold>` (shown only
 * below `md`; the desktop client renders `hidden md:block` alongside). The
 * scaffold bleeds the app-shell's mobile padding (`-mx-4 -mt-5`) so screens own
 * full-bleed headers/heroes, and sets the Geist body font to match the handoff.
 * The desktop `TopBar` is hidden on mobile, so `MobileTopBar` is the top chrome.
 */
export function MobileScaffold({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "md:hidden -mx-4 -mt-5 font-[family-name:var(--font-geist)] text-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Sticky mobile header. `big` = tab-root mode (mono eyebrow + Instrument-Serif
 * title + optional right control). Otherwise compact (back chevron + 16/600
 * title + optional mono sub). `transparent` drops the bg/border (recipe hero).
 */
export function MobileTopBar({
  title,
  eyebrow,
  sub,
  big,
  transparent,
  back,
  onBack,
  right
}: {
  title: React.ReactNode;
  eyebrow?: string;
  sub?: string;
  big?: boolean;
  transparent?: boolean;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex gap-[11px] pt-[max(env(safe-area-inset-top),0px)]",
        transparent ? "bg-transparent" : "bg-background",
        big ? "items-start px-4 pb-1 pt-[14px]" : "min-h-[54px] items-center px-[14px]",
        !big && !transparent && "border-b border-border"
      )}
    >
      {back && (
        <button
          type="button"
          aria-label="Back"
          onClick={onBack ?? (() => router.back())}
          className={cn(
            "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground",
            big && "mt-[2px]"
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className={cn("min-w-0 flex-1", big && "pt-[2px]")}>
        {eyebrow && (
          <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
            {eyebrow}
          </div>
        )}
        <div
          className={cn(
            "text-foreground",
            big
              ? "font-serif text-[32px] leading-none tracking-[-0.02em]"
              : "truncate text-[16px] font-semibold tracking-[-0.01em]"
          )}
        >
          {title}
        </div>
        {sub && (
          <div className="mt-[3px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-[color:var(--ink3)]">
            {sub}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

/** Small icon button matching the handoff's 38px square (used in headers). */
export function MobileIconButton({
  children,
  solid,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { solid?: boolean }) {
  return (
    <button
      className={cn(
        "relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] border",
        solid
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
