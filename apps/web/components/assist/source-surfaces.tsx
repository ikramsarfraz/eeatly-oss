"use client";

import * as React from "react";
import { Camera } from "./assist-icons";
import { AeButton, AeInput, AeTextarea } from "./field-atoms";

type Variant = "add" | "edit";

/** Photo → dashed well + "Choose a photo". Sits inside the input-surface card. */
export function PhotoSurface({
  variant,
  busy,
  onPick
}: {
  variant: Variant;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-[color:var(--ae-border)] px-6 py-10 text-center">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[color:var(--ae-sage-bg)] text-[color:var(--ae-accent)]">
        <Camera size={24} />
      </div>
      <div className="font-[family-name:var(--ae-display)] text-[24px] tracking-[-0.01em] text-[color:var(--ae-ink)]">
        {variant === "edit" ? "Photograph the change" : "Drop a recipe photo"}
      </div>
      <div className="max-w-[320px] text-[13px] leading-[1.45] text-[color:var(--ae-ink2)]">
        {variant === "edit"
          ? "A new label, a handwritten tweak, or the finished dish."
          : "A recipe card, a cookbook page, or the finished dish."}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
      <AeButton variant="ghost" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Reading…" : "Choose a photo"}
      </AeButton>
    </div>
  );
}

/** Text → textarea + right-aligned action. */
export function TextSurface({
  variant,
  busy,
  onSubmit
}: {
  variant: Variant;
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = React.useState("");
  return (
    <div className="flex flex-col gap-3">
      <AeTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ minHeight: variant === "edit" ? 96 : 150 }}
        placeholder={
          variant === "edit"
            ? "Describe the change — “double the beef, add prep times, make it spicier.”"
            : "Paste a recipe, or just name a dish and we'll draft one."
        }
      />
      <div className="flex justify-end">
        <AeButton disabled={busy || text.trim().length === 0} onClick={() => onSubmit(text)}>
          {busy
            ? variant === "edit"
              ? "Applying…"
              : "Building…"
            : variant === "edit"
              ? "Apply change"
              : "Build the recipe"}
        </AeButton>
      </div>
    </div>
  );
}

/** Link → single-line URL input + "Pull the recipe" (Add only). */
export function LinkSurface({
  busy,
  onSubmit
}: {
  busy: boolean;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = React.useState("");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <AeInput
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…  a recipe link or video"
        className="flex-1"
      />
      <AeButton
        disabled={busy || url.trim().length === 0}
        onClick={() => onSubmit(url)}
        className="shrink-0"
      >
        {busy ? "Saving…" : "Pull the recipe"}
      </AeButton>
    </div>
  );
}
