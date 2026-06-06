"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Camera, Mic, Document } from "./assist-icons";

export type AssistSource = "photo" | "voice" | "text";

const ALL_TABS: Array<{
  id: AssistSource;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: "photo", label: "Photo", Icon: Camera },
  { id: "voice", label: "Voice", Icon: Mic },
  { id: "text", label: "Text", Icon: Document }
];

/** Equal-width source tabs (Photo / Voice / Text). `items` narrows the set. */
export function SourceTabs({
  value,
  onChange,
  items
}: {
  value: AssistSource;
  onChange: (value: AssistSource) => void;
  items?: AssistSource[];
}) {
  const list = items ? ALL_TABS.filter((t) => items.includes(t.id)) : ALL_TABS;
  return (
    <div className="flex gap-2">
      {list.map(({ id, label, Icon }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-[7px] rounded-[12px] border-[1.5px] px-2 py-[14px] text-[13px] font-semibold transition-colors",
              active
                ? "border-[color:var(--ae-accent)] bg-[color:var(--ae-tab-active-bg)] text-[color:var(--ae-accent)]"
                : "border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] text-[color:var(--ae-ink2)] hover:text-[color:var(--ae-ink)]"
            )}
          >
            <Icon size={20} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
