"use client";

import { cn } from "@/lib/utils";
import type { EffortLevel } from "@/types";

const EFFORT_OPTIONS: Array<{ value: EffortLevel; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High" }
];

/** Single-select effort pills (handoff `EffortChips`). Selected = forest fill. */
export function EffortPills({
  value,
  onChange
}: {
  value: EffortLevel;
  onChange: (value: EffortLevel) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {EFFORT_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[99px] px-[15px] py-2 text-[13px] font-semibold transition-colors",
              active
                ? "border border-transparent bg-[color:var(--ae-forest)] text-[color:var(--ae-forest-text)]"
                : "border border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] text-[color:var(--ae-ink2)] hover:text-[color:var(--ae-ink)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
