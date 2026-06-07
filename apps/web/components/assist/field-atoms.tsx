"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Field label — 12.5px/600 ink, 7px bottom gap (handoff `Lbl`). */
export function Lbl({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-[7px] text-[12.5px] font-semibold text-[color:var(--ae-ink)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** 44px text input on the assist surface (handoff `inStyle`). */
export const aeInputClass =
  "box-border h-11 w-full rounded-[11px] border border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] px-[14px] font-[family-name:var(--ae-body)] text-[14.5px] leading-[1.5] text-[color:var(--ae-ink)] outline-none transition-colors placeholder:text-[color:var(--ae-ink3)] focus:border-[color:var(--ae-forest)]";

/** Multi-line textarea variant. */
export const aeTextareaClass =
  "box-border w-full resize-none rounded-[11px] border border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] px-[14px] py-3 font-[family-name:var(--ae-body)] text-[14.5px] leading-[1.5] text-[color:var(--ae-ink)] outline-none transition-colors placeholder:text-[color:var(--ae-ink3)] focus:border-[color:var(--ae-forest)]";

export const AeInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function AeInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(aeInputClass, className)} {...props} />;
});

export const AeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AeTextarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(aeTextareaClass, className)} {...props} />;
});

/** Solid forest button + ghost button (handoff `solidBtn`/`ghostBtn`). */
export function AeButton({
  variant = "solid",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[11px] px-[18px] font-[family-name:var(--ae-body)] text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        variant === "solid"
          ? "border-none bg-[color:var(--ae-forest)] px-5 text-[color:var(--ae-forest-text)] shadow-[var(--ae-cta-shadow)] hover:bg-[color:var(--ae-forest-soft)]"
          : "border border-[color:var(--ae-border)] bg-transparent text-[color:var(--ae-ink2)] hover:text-[color:var(--ae-ink)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Centered mono-caps divider between the assist bar and the manual form. */
export function AeDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-[color:var(--ae-border-soft)]" />
      <span className="whitespace-nowrap font-[family-name:var(--ae-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--ae-ink3)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[color:var(--ae-border-soft)]" />
    </div>
  );
}
