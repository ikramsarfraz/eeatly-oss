"use client";

import * as React from "react";
import { useVoiceRecorder } from "@/lib/refine/use-voice-recorder";
import { SUPPORTED_AUDIO_MEDIA_TYPES } from "@eeatly/api/validators/ai";
import { Mic, Stop, Upload, Check, Undo } from "./assist-icons";
import { AeButton } from "./field-atoms";

function mmss(total: number): string {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/** Decorative live waveform — 28 bars re-randomized ~110ms; static when the
 *  user prefers reduced motion (drive from real input level in a later pass). */
function Waveform({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active || reduced) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 110);
    return () => window.clearInterval(id);
  }, [active, reduced]);
  return (
    <div className="flex h-[34px] w-full max-w-[420px] items-center justify-center gap-[3px]">
      {Array.from({ length: 28 }).map((_, i) => {
        // Deterministic per (bar, tick) so the render stays pure — two
        // out-of-phase sine terms read as a lively, non-repeating waveform.
        const base =
          active && !reduced
            ? Math.abs(Math.sin(i * 0.7 + tick * 0.9)) * 0.7 +
              Math.abs(Math.sin(i * 2.3 + tick * 1.7)) * 0.3
            : 0.16;
        const h = Math.max(3, base * 34);
        return (
          <span
            key={i}
            className="w-[3px] rounded-[99px] bg-[color:var(--ae-accent)]"
            style={{ height: h, opacity: active ? 0.55 + base * 0.45 : 0.3 }}
          />
        );
      })}
    </div>
  );
}

/**
 * Auto-starting voice recorder (the friction fix). Mounts straight into
 * recording via the shared `useVoiceRecorder` hook (real MediaRecorder + mic
 * permission). Phases: recording → (parent extraction) working → ready.
 *
 * The recorder is agnostic about what "build" does — it hands the captured
 * Blob up via `onBuild`; the parent runs the extraction (Add: suggestFromVoice,
 * Edit: refine voice preview) and reflects progress through `isBuilding`.
 */
export function VoiceRecorder({
  prompt = false,
  isBuilding,
  onBuild
}: {
  /** Edit variant copy ("say the change out loud"). */
  prompt?: boolean;
  /** Parent's extraction mutation is in flight → show the "working" phase. */
  isBuilding: boolean;
  /** Hand the captured audio to the parent to run extraction. */
  onBuild: (audio: Blob, fileName: string) => void;
}) {
  const rec = useVoiceRecorder();
  const reduced = usePrefersReducedMotion();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const startedRef = React.useRef(false);

  // Auto-start once on mount — the whole point of the redesign.
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void rec.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileName = React.useMemo(() => {
    const mime = rec.blob?.type ?? "audio/webm";
    const ext = mime.includes("mp4")
      ? "mp4"
      : mime.includes("ogg")
        ? "ogg"
        : mime.includes("wav")
          ? "wav"
          : mime.includes("mpeg") || mime.includes("mp3")
            ? "mp3"
            : "webm";
    return `voice-note.${ext}`;
  }, [rec.blob]);

  const uploadInput = (
    <input
      ref={fileRef}
      type="file"
      accept={SUPPORTED_AUDIO_MEDIA_TYPES.join(",")}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onBuild(f, f.name);
      }}
    />
  );

  // ── working: extraction (transcription + recipe) in flight ──
  if (isBuilding) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 py-[26px]">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[color:var(--ae-sage-bg)] text-[color:var(--ae-accent)]">
          <span
            className="h-[22px] w-[22px] rounded-full border-[2.5px] border-current border-t-transparent"
            style={reduced ? undefined : { animation: "aeSpin .7s linear infinite" }}
          />
        </div>
        <div className="font-[family-name:var(--ae-display)] text-[23px] tracking-[-0.02em] text-[color:var(--ae-ink)]">
          Transcribing…
        </div>
        <div className="text-[13px] text-[color:var(--ae-ink3)]">
          Turning {mmss(rec.seconds)} of audio into ingredients &amp; steps
        </div>
      </div>
    );
  }

  // ── ready: stopped, blob captured, awaiting build ──
  if (rec.state === "ready" && rec.blob) {
    return (
      <div className="flex flex-col items-center gap-[14px] px-5 py-[26px]">
        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[color:var(--ae-sage-bg)] text-[color:var(--ae-accent)]">
          <Check size={22} />
        </div>
        <div className="font-[family-name:var(--ae-display)] text-[22px] tracking-[-0.02em] text-[color:var(--ae-ink)]">
          Got it — {mmss(rec.seconds)} captured.
        </div>
        <div className="max-w-[320px] text-center font-[family-name:var(--ae-display)] text-[13px] italic leading-[1.4] text-[color:var(--ae-ink2)]">
          {prompt
            ? "Tap build and we'll turn what you said into changes."
            : "Tap build and we'll turn it into ingredients & steps."}
        </div>
        <div className="flex gap-[10px]">
          <AeButton
            variant="ghost"
            onClick={() => {
              rec.reset();
              void rec.start();
            }}
          >
            <Undo size={15} /> Re-record
          </AeButton>
          <AeButton onClick={() => rec.blob && onBuild(rec.blob, fileName)}>
            Build the recipe
          </AeButton>
        </div>
      </div>
    );
  }

  // ── denied / unsupported: fall back to file upload ──
  if (rec.state === "denied" || rec.state === "error" || !rec.supported) {
    return (
      <div className="flex flex-col items-center gap-[14px] px-5 py-[26px] text-center">
        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[color:var(--ae-sage-bg)] text-[color:var(--ae-accent)]">
          <Mic size={22} />
        </div>
        <div className="max-w-[340px] text-[13px] leading-[1.45] text-[color:var(--ae-ink2)]">
          {rec.errorMessage ??
            "We need microphone access to record. Upload a voice file instead."}
        </div>
        {uploadInput}
        <AeButton variant="ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Upload a file
        </AeButton>
      </div>
    );
  }

  // ── recording (or requesting) ──
  const recording = rec.state === "recording";
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-[30px]">
      <div className="relative h-[76px] w-[76px]">
        {recording && !reduced && (
          <span
            className="absolute inset-0 rounded-full bg-[color:var(--ae-forest)] opacity-[0.18]"
            style={{ animation: "aePulse 1.6s ease-out infinite" }}
          />
        )}
        <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[color:var(--ae-forest)] text-[color:var(--ae-forest-text)]">
          <Mic size={30} />
        </div>
      </div>
      <div className="flex items-center gap-[9px]">
        <span
          className="h-2 w-2 rounded-full bg-[color:var(--ae-danger)]"
          style={reduced ? undefined : { animation: "aeBlink 1s steps(2) infinite" }}
        />
        <span className="font-[family-name:var(--ae-mono)] text-[13px] font-semibold tracking-[0.08em] text-[color:var(--ae-ink)]">
          {mmss(rec.seconds)}
        </span>
        <span className="whitespace-nowrap font-[family-name:var(--ae-mono)] text-[10.5px] uppercase tracking-[0.12em] text-[color:var(--ae-ink3)]">
          · {recording ? "recording" : "starting"}
        </span>
      </div>
      <Waveform active={recording} />
      <div className="max-w-[340px] text-center text-[12.5px] leading-[1.45] text-[color:var(--ae-ink2)]">
        {prompt
          ? "Say the change out loud — “double the garlic, swap to chicken.”"
          : "Just talk it through. Recording started automatically."}
      </div>
      <button
        type="button"
        onClick={rec.stop}
        disabled={!recording}
        className="inline-flex items-center gap-[9px] whitespace-nowrap rounded-[99px] bg-[color:var(--ae-forest)] px-[22px] py-[11px] text-[14px] font-semibold text-[color:var(--ae-forest-text)] shadow-[var(--ae-cta-shadow)] disabled:opacity-60"
      >
        <Stop size={15} /> Stop &amp; use
      </button>
      {uploadInput}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-[6px] whitespace-nowrap font-[family-name:var(--ae-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--ae-ink3)] hover:text-[color:var(--ae-ink2)]"
      >
        <Upload size={13} /> or upload a file instead
      </button>
    </div>
  );
}
