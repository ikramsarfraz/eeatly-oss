"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkle, ChevronRight, X } from "./assist-icons";
import { SourceTabs, type AssistSource } from "./source-tabs";
import { PhotoSurface, TextSurface } from "./source-surfaces";
import { VoiceRecorder } from "./voice-recorder";

export type AssistRunners = {
  /** Each runner runs extraction + pours the result into the form. Resolve =
   *  success (bar collapses); throw = handled error (bar stays open). */
  runPhoto: (file: File) => Promise<void>;
  runText: (text: string) => Promise<void>;
  runVoice: (audio: Blob, fileName: string) => Promise<void>;
};

const EDIT_CHIPS = ["Make it spicier", "Convert to grams", "Halve for 2 people"];

/**
 * The reusable AI Assist Bar — a sage pill that expands into a capture strip
 * and pours its result straight into the form. Shared by Add and Edit; the
 * `variant` swaps copy and adds the edit suggestion chips.
 */
export function AssistBar({
  variant,
  title,
  sub,
  cta,
  runPhoto,
  runText,
  runVoice
}: {
  variant: "add" | "edit";
  title: string;
  sub: string;
  cta: string;
} & AssistRunners) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<AssistSource>("photo");
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setOpen(false);
      setSource("photo");
    } catch {
      // Parent surfaces the toast; keep the bar open so the user can retry.
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-[14px] rounded-[16px] border px-4 py-[14px] text-left"
        style={{ background: "var(--ae-assist-bg)", borderColor: "var(--ae-assist-border)" }}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--ae-plaque-bg)] text-[color:var(--ae-plaque-fg)]">
          <Sparkle size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-[color:var(--ae-ink)]">{title}</span>
          <span className="mt-px block text-[12.5px] text-[color:var(--ae-ink2)]">{sub}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[99px] bg-[color:var(--ae-forest)] px-[15px] py-[9px] text-[13px] font-semibold text-[color:var(--ae-forest-text)]">
          {cta}
          <ChevronRight size={15} />
        </span>
      </button>
    );
  }

  return (
    <div
      className="rounded-[16px] border p-[18px]"
      style={{ background: "var(--ae-assist-bg)", borderColor: "var(--ae-assist-border)" }}
    >
      <div className="mb-[14px] flex items-center justify-between">
        <div className="flex items-center gap-[9px] text-[color:var(--ae-accent)]">
          <Sparkle size={16} />
          <span className="whitespace-nowrap font-[family-name:var(--ae-mono)] text-[10.5px] font-semibold uppercase tracking-[0.13em]">
            {variant === "edit" ? "Ask AI to change it" : "Let AI fill it in"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close AI assist"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--ae-ink2)] hover:text-[color:var(--ae-ink)]"
        >
          <X size={16} />
        </button>
      </div>

      <SourceTabs
        value={source}
        onChange={setSource}
        items={variant === "edit" ? ["text", "voice", "photo"] : undefined}
      />

      <div
        className={cn(
          "mt-[14px] rounded-[13px] border border-[color:var(--ae-border-soft)] bg-[color:var(--ae-surface)]",
          source === "voice" ? "p-1" : "p-[14px]"
        )}
      >
        {source === "photo" && (
          <PhotoSurface variant={variant} busy={busy} onPick={(f) => run(() => runPhoto(f))} />
        )}
        {source === "text" && (
          <TextSurface variant={variant} busy={busy} onSubmit={(t) => run(() => runText(t))} />
        )}
        {source === "voice" && (
          <VoiceRecorder
            prompt={variant === "edit"}
            isBuilding={busy}
            onBuild={(blob, fileName) => run(() => runVoice(blob, fileName))}
          />
        )}
      </div>

      {variant === "edit" && (
        <div className="mt-[14px] flex flex-wrap gap-[7px]">
          {EDIT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => run(() => runText(chip))}
              className="rounded-[99px] border bg-[color:var(--ae-surface)] px-3 py-[7px] text-[12.5px] font-medium text-[color:var(--ae-ink2)] hover:text-[color:var(--ae-ink)] disabled:opacity-55"
              style={{ borderColor: "var(--ae-assist-border)" }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
