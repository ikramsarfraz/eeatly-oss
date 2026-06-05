"use client";

import * as React from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import { useTourHelp } from "@/components/tour/tour-help-provider";
import { cn } from "@/lib/utils";

/**
 * Contextual per-screen "?" tip. A small circle beside a page title; clicking
 * opens a popover that explains the screen and links into the full Help panel.
 * Recreated from the Tour & Help handoff (ScreenTip).
 */
export function ScreenTip({
  title,
  body,
  align = "left"
}: {
  title: string;
  body: string;
  align?: "left" | "right";
}) {
  const { openHelp } = useTourHelp();
  const [open, setOpen] = React.useState(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        data-tour="screen-tip"
        onClick={() => setOpen((o) => !o)}
        aria-label="About this screen"
        aria-expanded={open}
        className={cn(
          "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[14px] font-bold leading-none transition-colors",
          open
            ? "border-primary bg-primary text-primary-foreground"
            : "border-[color:var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground"
        )}
      >
        ?
      </button>
      {open ? (
        <>
          {/* outside-click catcher */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            className={cn(
              "absolute top-[34px] z-[31] w-[290px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-[var(--border-soft,var(--border))] bg-[var(--surface)] p-[15px_16px_13px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.4)]",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            <div className="mb-2 flex items-center gap-[7px] text-primary">
              <Lightbulb className="h-[15px] w-[15px]" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[1.3px]">
                On this screen
              </span>
            </div>
            <div className="mb-[7px] font-serif text-[20px] leading-[1.1] tracking-[-0.02em] text-foreground">
              {title}
            </div>
            <p className="mb-3 text-[13px] leading-[1.5] text-muted-foreground">{body}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openHelp();
              }}
              className="inline-flex items-center gap-[5px] text-[13px] font-semibold text-primary"
            >
              Open full guide <ChevronRight className="h-[15px] w-[15px]" />
            </button>
          </div>
        </>
      ) : null}
    </span>
  );
}
