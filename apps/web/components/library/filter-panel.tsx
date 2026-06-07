"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FACET_GROUPS, EFFORT_FACET_OPTIONS, effortLabel, type FacetKey } from "@/lib/meals/tags";
import type { FacetState } from "@/lib/meals/facets";

/**
 * R36 — the faceted filter body (groups of multi-select chips with live count
 * badges). Shared by the desktop popover and the mobile sheet; the wrapper
 * supplies the chrome (anchor/footer) and whether selection applies live or is
 * staged. Groups with no available options are hidden.
 */
export function FilterPanelBody({
  options,
  counts,
  state,
  onToggle
}: {
  options: Record<FacetKey, string[]>;
  counts: Record<FacetKey, Record<string, number>>;
  state: FacetState;
  onToggle: (key: FacetKey, value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {FACET_GROUPS.map((group) => {
        // Effort uses a fixed order/labels; other groups are data-derived.
        const values =
          group.key === "effort"
            ? EFFORT_FACET_OPTIONS.map((o) => o.value).filter((v) => options.effort.includes(v))
            : options[group.key];
        if (values.length === 0) return null;
        return (
          <div key={group.key}>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {values.map((value) => {
                const active = state[group.key].has(value);
                const count = counts[group.key]?.[value] ?? 0;
                const label = group.key === "effort" ? effortLabel(value) : value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onToggle(group.key, value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-primary bg-[color:var(--sage-soft)] text-primary"
                        : "border-border bg-transparent text-foreground hover:bg-[color:var(--surface-2)]"
                    )}
                  >
                    {label}
                    <span className="font-mono text-[10px] tabular-nums opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
