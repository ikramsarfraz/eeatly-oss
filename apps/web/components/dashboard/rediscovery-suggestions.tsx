import Link from "next/link";
import type { Route } from "next";
import { Clock, Flame, History, Sparkles, Zap } from "lucide-react";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { RediscoveryTrackButton } from "@/components/dashboard/rediscovery-track-button";
import { cn } from "@/lib/utils";
import { formatDaysAgo } from "@/lib/utils";
import type { RediscoverySuggestion } from "@/types";

const reasonConfig = {
  neglected: {
    icon: History,
    colorClass: "bg-[var(--accent-soft)] text-[#8c4a25] dark:text-[color:var(--terra-fg)]",
    label: "Neglected"
  },
  frequent: {
    icon: Flame,
    colorClass: "bg-[var(--primary-soft)] text-primary",
    label: "Repeat"
  },
  quick: {
    icon: Zap,
    colorClass: "bg-[var(--primary-soft)] text-primary",
    label: "Quick win"
  },
  favorite: {
    icon: Sparkles,
    colorClass: "bg-[#f3e8c8] text-[#8a6a1c] dark:bg-wheat dark:text-[color:var(--wheat-fg)]",
    label: "Favorite"
  }
} as const;

const effortBadgeClass = {
  quick: "bg-[var(--primary-soft)] text-primary border-transparent",
  easy: "bg-[var(--primary-soft)] text-primary border-transparent",
  medium: "bg-[var(--accent-soft)] text-[#8c4a25] border-transparent dark:text-[color:var(--terra-fg)]",
  high_effort: "bg-muted text-muted-foreground"
};

export function RediscoverySuggestions({
  suggestions
}: {
  suggestions: RediscoverySuggestion[];
}) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-[14px] border bg-[var(--surface)] p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Ideas for tonight</p>
        <p className="mt-1 text-xs">
          Log a few meals and eeatly will start resurfacing good options.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-[14px] sm:grid-cols-2">
      {suggestions.map((suggestion) => {
        const config = reasonConfig[suggestion.reason];
        const Icon = config.icon;
        const effort = suggestion.effortLevel as keyof typeof effortBadgeClass | null;

        return (
          // R25 — the whole rediscovery card navigates to /meal/[id].
          // The LogAgainButton and RediscoveryTrackButton inside the
          // footer stay independently tappable via stopPropagation
          // boundaries (one per group). Using `<Link>` rather than a
          // `router.push` onClick preserves right-click and keyboard
          // navigation. Wrapped <article> tag with className "group"
          // so hover state can still bubble visually.
          <Link
            key={suggestion.id}
            href={`/meal/${suggestion.mealId}` as Route}
            className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Open recipe for ${suggestion.mealName}`}
          >
            <article
              className="flex h-full flex-col gap-[14px] rounded-[14px] border bg-[var(--surface)] p-[18px] transition-colors group-hover:border-[var(--border-strong,#cfccc0)]"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              {/* Top row: reason glyph + effort badge */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-[7px] text-[11.5px] font-medium text-muted-foreground">
                  <span
                    className={cn(
                      "flex h-[22px] w-[22px] items-center justify-center rounded-[6px]",
                      config.colorClass
                    )}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.4} />
                  </span>
                  {config.label}
                  {suggestion.title ? ` · ${suggestion.title}` : ""}
                </div>
                {effort ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-px text-[11px] font-medium",
                      effortBadgeClass[effort] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {effort.replace("_", " ")}
                  </span>
                ) : null}
              </div>

              {/* Meal name + description */}
              <div>
                <h3 className="font-serif text-[24px] font-normal leading-[1.15] tracking-[-0.005em] underline-offset-2 group-hover:underline">
                  {suggestion.mealName}
                </h3>
                <p className="mt-1 text-[13px] leading-[1.5] text-muted-foreground">
                  {suggestion.description}
                </p>
              </div>

              {/* Footer — LogAgain + Track buttons. Each interactive
                  control gets wrapped in its own stopPropagation
                  boundary so taps fire the button's onClick without
                  bubbling to the outer <Link>. */}
              <div className="grid gap-3 border-t border-[var(--border)] pt-3">
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                    }
                  }}
                >
                  <LogAgainButton
                    mealName={suggestion.mealName}
                    effortLevel={suggestion.effortLevel}
                    variant="default"
                    size="default"
                    className="w-full"
                    compact
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  {suggestion.daysSinceCooked !== null ? (
                    <div className="flex flex-col text-[11.5px] text-[var(--subtle-fg,#8b948e)]">
                      <span className="flex items-center gap-[5px]">
                        <Clock className="h-[11px] w-[11px]" />
                        Last cooked
                      </span>
                      <span>{formatDaysAgo(suggestion.daysSinceCooked)}</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                      }
                    }}
                  >
                    <RediscoveryTrackButton suggestion={suggestion} />
                  </div>
                </div>
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}
