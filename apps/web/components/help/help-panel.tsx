"use client";

import * as React from "react";
import { ChevronRight, Search, Sparkles, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { HELP_CATEGORIES } from "@/lib/help/content";
import { cn } from "@/lib/utils";

/**
 * Help slide-over (right panel). Searchable, per-feature how-to guides plus a
 * "Replay the app tour" CTA. Full-width on mobile, 440px on desktop. Recreated
 * from the Tour & Help design handoff using the app's tokens (so it dark-modes).
 */
export function HelpPanel({
  open,
  onClose,
  onReplayTour
}: {
  open: boolean;
  onClose: () => void;
  onReplayTour: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery("");
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 border-l bg-background p-0 sm:w-[440px] sm:max-w-[440px]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[color:var(--border)] px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">
                Help &amp; guides
              </p>
              <h2 className="font-serif text-[32px] leading-none tracking-[-0.02em] text-foreground">
                How can we help?
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2.5 rounded-[10px] border border-[color:var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
            <Search className="h-[17px] w-[17px] text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides…"
              className="flex-1 border-none bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 pb-7 pt-[18px]">
          {!q ? (
            <button
              type="button"
              onClick={onReplayTour}
              className="mb-[22px] flex w-full items-center gap-3 rounded-[14px] bg-primary px-4 py-[15px] text-left text-primary-foreground shadow-[0_6px_20px_-8px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-white/15">
                <Sparkles className="h-[21px] w-[21px]" />
              </span>
              <span className="flex-1">
                <span className="block font-serif text-[19px] leading-none tracking-[-0.02em]">
                  Replay the app tour
                </span>
                <span className="mt-[3px] block text-[12px] opacity-80">
                  The 60-second guided walkthrough.
                </span>
              </span>
              <ChevronRight className="h-[18px] w-[18px] opacity-70" />
            </button>
          ) : null}

          {HELP_CATEGORIES.map((group) => {
            const items = group.items.filter(
              (it) =>
                !q ||
                it.q.toLowerCase().includes(q) ||
                it.body.join(" ").toLowerCase().includes(q)
            );
            if (!items.length) return null;
            const Icon = group.icon;
            return (
              <div key={group.cat} className="mb-[22px]">
                <div className="mb-2.5 flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-[15px] w-[15px] text-primary" />
                  <span className="whitespace-nowrap text-[11.5px] font-semibold uppercase tracking-[1.4px]">
                    {group.cat}
                  </span>
                </div>
                <div className="overflow-hidden rounded-[14px] border border-[var(--border-soft,var(--border))] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
                  {items.map((it, idx) => {
                    const key = group.cat + it.q;
                    const isOpen = Boolean(openItems[key]) || Boolean(q);
                    return (
                      <div
                        key={it.q}
                        className={cn(
                          idx === 0 ? "" : "border-t border-[var(--border-soft,var(--border))]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenItems((o) => ({ ...o, [key]: !o[key] }))}
                          className="flex w-full items-center gap-2.5 px-[15px] py-[13px] text-left"
                        >
                          <span className="flex-1 text-[14px] font-semibold tracking-[-0.1px] text-foreground">
                            {it.q}
                          </span>
                          <ChevronRight
                            className={cn(
                              "h-[17px] w-[17px] text-muted-foreground transition-transform duration-200",
                              isOpen && "rotate-90"
                            )}
                          />
                        </button>
                        {isOpen ? (
                          <div className="px-[15px] pb-[15px]">
                            {it.kind === "steps" ? (
                              <div className="flex flex-col gap-[9px]">
                                {it.body.map((s, i) => (
                                  <div key={i} className="flex items-start gap-[11px]">
                                    <span className="mt-px flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full bg-[color:var(--sage-soft)] font-mono text-[10.5px] font-semibold text-primary">
                                      {i + 1}
                                    </span>
                                    <span className="flex-1 text-[13px] leading-[1.5] text-foreground">
                                      {s}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : it.kind === "list" ? (
                              <div className="flex flex-col gap-[7px]">
                                {it.body.map((s, i) => (
                                  <div key={i} className="flex items-start gap-2.5">
                                    <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
                                    <span className="flex-1 text-[13px] leading-[1.5] text-foreground">
                                      {s}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {it.body.map((s, i) => (
                                  <p key={i} className="text-[13px] leading-[1.55] text-muted-foreground">
                                    {s}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <p className="mt-1.5 text-center font-mono text-[10.5px] uppercase tracking-[1.2px] text-muted-foreground">
            Still stuck? Email hello@eeatly.app
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
