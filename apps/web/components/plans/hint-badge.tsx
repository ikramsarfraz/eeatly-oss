"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/db/schema";

export type HintData = {
  verdict: Verdict | null;
  actualEffort: "quick" | "easy" | "medium" | "high_effort" | null;
  annotationNotes: string | null;
  timeTakenMinutes: number | null;
};

export function HintBadge({ hint }: { hint: HintData }) {
  // Verdict drives the visible label + color. Other annotation fields ride
  // along inside the tooltip so the badge stays compact.
  const meta = verdictMeta(hint.verdict);
  if (!meta && !hint.annotationNotes && !hint.timeTakenMinutes && !hint.actualEffort) {
    // Should never happen — caller filters empty hints upstream — but
    // render nothing rather than an empty badge.
    return null;
  }

  const tooltipParts: string[] = [];
  if (hint.timeTakenMinutes !== null) {
    tooltipParts.push(formatMinutes(hint.timeTakenMinutes));
  }
  if (hint.actualEffort) {
    tooltipParts.push(`Effort: ${hint.actualEffort.replace("_", " ")}`);
  }
  if (hint.annotationNotes) {
    tooltipParts.push(`"${hint.annotationNotes}"`);
  }
  const tooltip = tooltipParts.length > 0 ? tooltipParts.join(" · ") : null;

  const label = meta?.label ?? "Last time: noted";
  const className = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
    meta?.className ?? "border-border bg-background/60 text-muted-foreground"
  );

  if (!tooltip) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className} tabIndex={0} role="note" aria-label={tooltip}>
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function verdictMeta(
  verdict: Verdict | null
): { label: string; className: string } | null {
  switch (verdict) {
    case "repeat":
      // Subtle green — positive but not loud. The user might still want
      // to swap it out; the hint is advisory.
      return {
        label: "Last time: hit",
        className: "border-emerald-200 bg-emerald-50 text-emerald-900"
      };
    case "modify":
      return {
        label: "Last time: needs tweaking",
        className: "border-amber-200 bg-amber-50 text-amber-900"
      };
    case "do_not_repeat":
      // Red-tinted but not aggressive — the dish is still on the plan; we
      // don't want to scream at the user about their own past choice.
      return {
        label: "Last time: don't repeat",
        className: "border-rose-200 bg-rose-50 text-rose-900"
      };
    default:
      return null;
  }
}

function formatMinutes(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `Took ${h}h ${m}m` : `Took ${h}h`;
  }
  return `Took ${min}m`;
}
