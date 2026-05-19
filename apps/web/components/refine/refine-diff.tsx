"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import type { PendingChange } from "@eeatly/api/validators/refine";
import { cn } from "@/lib/utils";

/**
 * Round 30 — diff row primitive used inside Refine's chat history
 * assistant cards AND inside the Refine sidebar's "Will affect"
 * list. Both Refine + Review surfaces speak the same `add` / `change`
 * / `remove` vocabulary; this component owns the visual treatment.
 *
 * Visual:
 *   - 18px colored circle icon (sage + plus / wheat + arrow / danger
 *     + minus).
 *   - Body label (13.5px medium ink; line-through on `remove`).
 *   - Optional mono-caps sub note (10.5px, ink-3, letter-spacing).
 */

type Kind = PendingChange["kind"];

const KIND_STYLE: Record<
  Kind,
  { bg: string; text: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  add: {
    bg: "bg-[color:var(--sage)]",
    text: "text-[color:var(--sage-fg)]",
    Icon: Plus
  },
  change: {
    bg: "bg-[color:var(--wheat)]",
    text: "text-[color:var(--wheat-fg)]",
    Icon: ArrowRight
  },
  remove: {
    bg: "bg-[color:var(--danger-soft)]",
    text: "text-[color:var(--danger-fg)]",
    Icon: Minus
  }
};

export function RefineDiff({
  kind,
  label,
  note
}: {
  kind: Kind;
  label: string;
  note?: string | null;
}) {
  const { bg, text, Icon } = KIND_STYLE[kind];
  return (
    <div className="grid grid-cols-[18px_1fr] items-start gap-2.5 py-1">
      <span
        aria-hidden
        className={cn(
          "mt-[1px] flex h-[18px] w-[18px] items-center justify-center rounded-full",
          bg,
          text
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[13.5px] font-medium leading-snug text-foreground",
            kind === "remove" && "line-through text-muted-foreground"
          )}
        >
          {label}
        </p>
        {note ? (
          <p
            className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.13em" }}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
