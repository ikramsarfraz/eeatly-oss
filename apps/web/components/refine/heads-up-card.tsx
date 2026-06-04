"use client";

import * as React from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { HeadsUp } from "@eeatly/api/validators/refine";
import { cn } from "@/lib/utils";

/**
 * Round 30 — sage-tinted heads-up card.
 *
 * Renders the R18 rule-engine output (`session.headsUp`) in a small
 * informational/alert surface. Used on both the Refine composer
 * sidebar AND the Review hero — same data, same visual, so it lives
 * here as a shared primitive.
 *
 * Severity treatment:
 *   - `info` — sage-tinted background (`--sage-soft`), sparkle icon
 *     in forest. The non-blocking ambient note.
 *   - `warn` — wheat-tinted background (`--wheat-soft`), triangle
 *     icon in wheat-fg. The "you probably want to override before
 *     saving" flag.
 *
 * The advisory `body` is the whole value here. The old `suggestedAction`
 * ("Keep effort …") rendered as a permanently-disabled no-op button
 * (there's no effort-override endpoint — effort is derived from cook
 * logs), so it's no longer rendered. The data still flows through in case
 * a real override lands later.
 */
export function HeadsUpCard({ headsUp }: { headsUp: HeadsUp }) {
  const warn = headsUp.severity === "warn";
  const Icon = warn ? AlertTriangle : Sparkles;
  return (
    <div
      className={cn(
        "grid gap-2 rounded-[14px] border p-4",
        warn
          ? "border-[color:var(--wheat)] bg-[color:var(--wheat-soft)]"
          : "border-[color:var(--sage)] bg-[color:var(--sage-soft)]"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            warn
              ? "text-[color:var(--wheat-fg)]"
              : "text-primary"
          )}
        />
        <span
          className={cn(
            "font-mono text-[10.5px] uppercase",
            warn
              ? "text-[color:var(--wheat-fg)]"
              : "text-primary"
          )}
          style={{ letterSpacing: "0.14em" }}
        >
          Heads up
        </span>
      </div>
      <p className="text-[13.5px] font-semibold leading-snug text-foreground">
        {headsUp.title || "Heads up"}
      </p>
      <p className="text-[13px] leading-[1.55] text-foreground/85">
        {headsUp.body}
      </p>
    </div>
  );
}
