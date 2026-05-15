import { cn } from "@/lib/utils";
import type { EffortLevel } from "@/types";

type EffortDisplay = {
  label: string;
  // Number of filled dots out of 3.
  dots: 1 | 2 | 3;
  fg: string;
  bg: string;
};

// Maps codebase enum → display. `high_effort` collapses to "Project" — the
// design's friendlier label for a long cook.
const DISPLAY: Record<EffortLevel, EffortDisplay> = {
  quick: {
    label: "Quick",
    dots: 1,
    fg: "var(--primary)",
    bg: "var(--primary-soft)"
  },
  easy: {
    label: "Easy",
    dots: 1,
    fg: "#2f6f58",
    bg: "var(--primary-soft)"
  },
  medium: {
    label: "Medium",
    dots: 2,
    fg: "#8a6a1c",
    bg: "var(--warn-soft)"
  },
  high_effort: {
    label: "Project",
    dots: 3,
    fg: "#8c4a25",
    bg: "var(--accent-soft)"
  }
};

type EffortPillProps = {
  level: EffortLevel;
  /** Hides the label text — shows just the dots. Useful in dense rows. */
  compact?: boolean;
  className?: string;
};

export function EffortPill({ level, compact = false, className }: EffortPillProps) {
  const display = DISPLAY[level];
  const dotsAriaLabel = `Effort: ${display.label.toLowerCase()} (${display.dots} of 3)`;

  return (
    <span
      aria-label={dotsAriaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className
      )}
      style={{ color: display.fg, background: display.bg }}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-[2px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <span
            key={i}
            className="block h-[5px] w-[5px] rounded-full"
            style={{
              background: i < display.dots ? "currentColor" : "transparent",
              border: i < display.dots ? "none" : "1px solid currentColor",
              opacity: i < display.dots ? 1 : 0.4
            }}
          />
        ))}
      </span>
      {!compact ? display.label : null}
    </span>
  );
}
