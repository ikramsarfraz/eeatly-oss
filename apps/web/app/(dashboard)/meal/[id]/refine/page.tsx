"use client";

import * as React from "react";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import {
  Camera,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Square,
  Type
} from "lucide-react";
import type {
  PendingChange,
  RefineSource
} from "@eeatly/api/validators/refine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { SectionLabel } from "@/components/ui/section-label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToastShortcuts } from "@/components/ui/toast";
import { getDeviceId } from "@/lib/refine/device-id";
import {
  describePendingChange,
  summariseCounts
} from "@/lib/refine/format";
import {
  blobToBase64,
  useVoiceRecorder
} from "@/lib/refine/use-voice-recorder";
import { getCause } from "@/lib/trpc/errors";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Round 22 — web Refine composer.
 *
 * Mirrors the mobile screen at
 * `apps/mobile/app/(authed)/meal/[id]/refine/index.tsx` (R20).
 * Three input modes (text / voice / photo) drive the `refine.*`
 * procedures; the chat history of past turns sits below the composer
 * with accept/reject toggles, and a "Review & save" CTA navigates to
 * the per-meal review screen.
 *
 * Stays client-side: Refine is real-time + stateful, SSR offers no
 * win, and the procedures all assume a session id minted on mount.
 */

type Mode = "text" | "voice" | "photo";

const EXAMPLE_PROMPTS = [
  "Make it spicier",
  "Convert to grams",
  "Halve for 2 people",
  "Add prep notes"
];

const SOURCE_ICON: Record<RefineSource, React.ComponentType<{ className?: string }>> = {
  text: Type,
  voice: Mic,
  photo: Camera
};

const MODE_ICON: Record<Mode, React.ComponentType<{ className?: string }>> = {
  text: Type,
  voice: Mic,
  photo: Camera
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function mimeToExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export default function RefineComposerPage() {
  const params = useParams<{ id: string }>();
  const mealId = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const toast = useToastShortcuts();
  const utils = trpc.useUtils();

  /* ─── Meal + session bootstrap ──────────────────────────────── */

  const mealQuery = trpc.meals.getById.useQuery(
    { mealId },
    { enabled: mealId.length > 0, staleTime: 30_000 }
  );

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const bootstrappedRef = React.useRef(false);

  const startSessionMut = trpc.refine.startSession.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      setSessionId(data.sessionId);
      utils.refine.getPendingChanges.setData({ sessionId: data.sessionId }, data);
    },
    onError: (err) => {
      setBootstrapError(err.message);
    }
  });

  React.useEffect(() => {
    if (!mealId || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const deviceId = getDeviceId();
    // Empty deviceId is only possible during SSR (helper returns "" then),
    // which never reaches this client effect. If a browser somehow blocks
    // localStorage entirely, the validator rejects empty + onError sets
    // the bootstrap error via the mutation hook below.
    startSessionMut.mutate({ mealId, deviceId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  const sessionQuery = trpc.refine.getPendingChanges.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: !!sessionId, staleTime: Infinity }
  );
  const session = sessionQuery.data;

  /* ─── Composer state ────────────────────────────────────────── */

  const [mode, setMode] = React.useState<Mode>("text");
  const [draft, setDraft] = React.useState("");
  const lastDraftRef = React.useRef("");
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const recorder = useVoiceRecorder();

  React.useEffect(() => {
    if (recorder.errorMessage)
      toast.error({ title: "Recording", description: recorder.errorMessage });
  }, [recorder.errorMessage, toast]);

  React.useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  /* ─── Mutations ─────────────────────────────────────────────── */

  function handleErrorToast(err: unknown, fallback: string) {
    const cause = getCause(err);
    const message =
      err instanceof Error ? err.message : fallback;
    if (cause?.reason === "UPGRADE_REQUIRED") {
      toast.error({
        title: "Upgrade required",
        description: message
      });
      return;
    }
    if (cause?.reason === "RATE_LIMITED") {
      toast.error({
        title: "Daily AI limit reached",
        description: message
      });
      return;
    }
    toast.error({ title: "Refine", description: message });
  }

  const submitTextMut = trpc.refine.submitTextTurn.useMutation({
    onSuccess: (data) => {
      if (!data || !sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
    },
    onError: (err) => {
      setDraft((prev) => prev || lastDraftRef.current);
      handleErrorToast(err, "Couldn't send that prompt.");
    }
  });

  const submitVoiceMut = trpc.refine.submitVoiceTurn.useMutation({
    onSuccess: (data) => {
      if (!data || !sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
      recorder.reset();
    },
    onError: (err) => handleErrorToast(err, "Couldn't process that voice note.")
  });

  const submitPhotoMut = trpc.refine.submitPhotoTurn.useMutation({
    onSuccess: (data) => {
      if (!data || !sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
    },
    onError: (err) => handleErrorToast(err, "Couldn't analyse that photo.")
  });

  const toggleMut = trpc.refine.toggleTurnAccepted.useMutation({
    onSuccess: (data) => {
      if (!data || !sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
    },
    onError: (err) => {
      // Optimistic flip already applied — invalidate to recover truth.
      if (sessionId) void utils.refine.getPendingChanges.invalidate({ sessionId });
      handleErrorToast(err, "Couldn't update that turn.");
    }
  });

  const discardMut = trpc.refine.discard.useMutation({
    onSuccess: () => {
      toast.info({ title: "Discarded refinements" });
      router.push(`/meal/${mealId}` as Route);
    },
    onError: (err) => handleErrorToast(err, "Couldn't discard the session.")
  });

  /* ─── Handlers ──────────────────────────────────────────────── */

  function handleSubmitText() {
    if (!sessionId) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    lastDraftRef.current = trimmed;
    setDraft("");
    submitTextMut.mutate({ sessionId, prompt: trimmed });
  }

  async function handleSubmitVoice() {
    if (!sessionId || !recorder.blob) return;
    try {
      const audioBase64 = await blobToBase64(recorder.blob);
      const ext = mimeToExtension(recorder.blob.type);
      const mediaType = recorder.blob.type as
        | "audio/mpeg"
        | "audio/mp3"
        | "audio/mp4"
        | "audio/m4a"
        | "audio/x-m4a"
        | "audio/ogg"
        | "audio/opus"
        | "audio/wav"
        | "audio/x-wav"
        | "audio/webm"
        | "audio/flac";
      submitVoiceMut.mutate({
        sessionId,
        audioBase64,
        mediaType,
        fileName: `refine-voice.${ext}`
      });
    } catch {
      toast.error({
        title: "Couldn't read that recording.",
        description: "Try recording again."
      });
    }
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmitPhoto() {
    if (!sessionId || !photoFile) return;
    try {
      const imageBase64 = await blobToBase64(photoFile);
      const mediaType = photoFile.type as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";
      submitPhotoMut.mutate({ sessionId, imageBase64, mediaType });
    } catch {
      toast.error({ title: "Couldn't read that photo.", description: "Try a different file." });
    }
  }

  function handleToggleTurn(turnId: string, currentAccepted: boolean) {
    if (!sessionId || !session) return;
    // Optimistic flip in the cache: same shape mobile uses.
    const current = utils.refine.getPendingChanges.getData({ sessionId });
    if (current) {
      const nextTurns = current.turns.map((t) =>
        t.id === turnId ? { ...t, accepted: !currentAccepted } : t
      );
      const nextPending = nextTurns
        .filter((t) => t.accepted)
        .flatMap((t) => t.proposed);
      utils.refine.getPendingChanges.setData(
        { sessionId },
        {
          ...current,
          turns: nextTurns,
          pendingChanges: nextPending,
          summary: {
            additions: nextPending.filter((c) => c.kind === "add").length,
            changes: nextPending.filter((c) => c.kind === "change").length,
            removals: nextPending.filter((c) => c.kind === "remove").length
          }
        }
      );
    }
    toggleMut.mutate({ sessionId, turnId, accepted: !currentAccepted });
  }

  function handleDiscard() {
    if (!sessionId) {
      router.push(`/meal/${mealId}` as Route);
      return;
    }
    discardMut.mutate({ sessionId });
  }

  /* ─── Loading + error ───────────────────────────────────────── */

  if (mealQuery.isPending || (!session && !bootstrapError)) {
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-3 px-4 py-8 sm:px-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Opening refine session…</p>
      </div>
    );
  }

  if (!mealQuery.data) {
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-2 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-2xl">Recipe not found</h1>
        <p className="text-sm text-muted-foreground">
          It may have been archived since you opened it.
        </p>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="mx-auto grid w-full max-w-[720px] gap-3 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-2xl">Couldn&apos;t open Refine</h1>
        <p className="text-sm text-muted-foreground">{bootstrapError}</p>
        <Button onClick={() => router.push(`/meal/${mealId}`)} className="mt-2 w-fit">
          Back to recipe
        </Button>
      </div>
    );
  }

  const meal = mealQuery.data;
  const turns = session?.turns ?? [];
  const pending = session?.pendingChanges ?? [];
  const counts = summariseCounts(pending);
  const resolverCtx = {
    ingredients: meal.structuredIngredients ?? [],
    steps: meal.structuredSteps ?? []
  };
  const submitting =
    submitTextMut.isPending ||
    submitVoiceMut.isPending ||
    submitPhotoMut.isPending;

  return (
    <article className="mx-auto grid w-full max-w-[720px] gap-6 px-4 pb-12 pt-3 sm:px-6 sm:pt-4">
      <PageTitle
        kicker="Refine"
        title={meal.name}
        size="l"
        subtitle="Send a prompt, voice note, or photo. I'll suggest changes you can accept before saving."
      />

      {/* Composer card */}
      <section className="grid gap-4 rounded-2xl border border-[var(--primary-soft)] bg-[var(--primary-soft)]/40 p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--secondary-foreground)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-mono">Tell me what to change</span>
        </div>

        <ModeTabs mode={mode} onChange={setMode} />

        {mode === "text" ? (
          <TextSurface
            draft={draft}
            onChange={setDraft}
            onSubmit={handleSubmitText}
            disabled={!sessionId || submitting}
            sending={submitTextMut.isPending}
          />
        ) : null}

        {mode === "voice" ? (
          <VoiceSurface
            recorder={recorder}
            onSubmit={handleSubmitVoice}
            sending={submitVoiceMut.isPending}
          />
        ) : null}

        {mode === "photo" ? (
          <PhotoSurface
            inputRef={photoInputRef}
            file={photoFile}
            preview={photoPreview}
            onChange={handlePhotoChange}
            onSubmit={handleSubmitPhoto}
            sending={submitPhotoMut.isPending}
          />
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setMode("text");
                setDraft(label);
              }}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] text-foreground/80 transition hover:bg-[var(--surface-2)]"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Session history */}
      <section className="grid gap-3">
        <SectionLabel>
          {turns.length > 0
            ? `This session · ${turns.length} turn${turns.length === 1 ? "" : "s"}`
            : "This session"}
        </SectionLabel>
        {turns.length === 0 ? (
          <p className="font-serif italic text-muted-foreground">
            Send a refinement above to get started.
          </p>
        ) : (
          <ul className="grid list-none gap-4">
            {turns.map((turn) => (
              <li key={turn.id}>
                <TurnBlock
                  turn={turn}
                  resolverCtx={resolverCtx}
                  onTogglePress={handleToggleTurn}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending summary + actions */}
      {counts.total > 0 ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Pending changes</SectionLabel>
            <span
              className="text-[12px] text-muted-foreground/80"
              aria-hidden
              title="Manual editing not implemented in this round"
            >
              Or edit by hand →
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <span className="text-[13px] font-semibold">
              {counts.total} change{counts.total === 1 ? "" : "s"} ready
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {counts.add > 0 ? <Badge variant="sage">{`+${counts.add}`}</Badge> : null}
              {counts.change > 0 ? <Badge variant="wheat">{`~${counts.change}`}</Badge> : null}
              {counts.remove > 0 ? <Badge variant="danger">{`−${counts.remove}`}</Badge> : null}
            </span>
          </div>
        </section>
      ) : null}

      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        <DiscardButton
          onConfirm={handleDiscard}
          pending={discardMut.isPending}
          dirty={counts.total > 0 || turns.length > 0}
        />
        <Button
          type="button"
          disabled={counts.total === 0 || !sessionId}
          onClick={() =>
            sessionId &&
            router.push(
              `/meal/${mealId}/refine/review?sessionId=${encodeURIComponent(sessionId)}` as Route
            )
          }
          className="min-h-[44px]"
        >
          Review changes{counts.total > 0 ? ` · ${counts.total}` : ""}
        </Button>
      </div>
    </article>
  );
}

/* ─── Composer subcomponents ───────────────────────────────── */

function ModeTabs({
  mode,
  onChange
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const modes: Mode[] = ["text", "voice", "photo"];
  return (
    <div className="flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
      {modes.map((m) => {
        const Icon = MODE_ICON[m];
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-medium transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        );
      })}
    </div>
  );
}

function TextSurface({
  draft,
  onChange,
  onSubmit,
  disabled,
  sending
}: {
  draft: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  sending: boolean;
}) {
  const canSubmit = draft.trim().length > 0 && !disabled;
  return (
    <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        placeholder={`e.g. "Bump chicken to 600g and add ginger paste, 1 tbsp."`}
        rows={3}
        disabled={disabled}
        className="min-h-[64px] w-full resize-none border-0 bg-transparent font-serif text-[15px] italic leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
        <span className="text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </span>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="min-h-[40px]"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

function VoiceSurface({
  recorder,
  onSubmit,
  sending
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  onSubmit: () => void;
  sending: boolean;
}) {
  const isRecording = recorder.state === "recording";
  const isReady = recorder.state === "ready";
  const isRequesting = recorder.state === "requesting";
  const denied = recorder.state === "denied";

  if (!recorder.supported) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-muted-foreground">
        Recording isn&apos;t supported in this browser. Try the text or photo mode.
      </div>
    );
  }

  return (
    <div className="grid place-items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6">
      <button
        type="button"
        onClick={() => {
          if (isReady) {
            recorder.reset();
            void recorder.start();
            return;
          }
          if (isRecording) {
            recorder.stop();
            return;
          }
          void recorder.start();
        }}
        disabled={isRequesting || sending}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={cn(
          "grid h-20 w-20 place-items-center rounded-full text-primary-foreground shadow-md transition",
          isRecording
            ? "bg-destructive animate-pulse"
            : "bg-primary hover:scale-[1.03] active:scale-[0.98]"
        )}
      >
        {isRequesting || sending ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : isRecording ? (
          <Square className="h-7 w-7" fill="currentColor" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </button>

      <Waveform active={isRecording} />

      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        {isRecording
          ? `${formatDuration(recorder.seconds)} · listening`
          : isReady
            ? `${formatDuration(recorder.seconds)} captured`
            : isRequesting
              ? "Requesting microphone…"
              : denied
                ? "Microphone access blocked"
                : "Tap to record"}
      </p>

      {isReady && recorder.url ? (
        <audio src={recorder.url} controls className="w-full max-w-[360px]" />
      ) : null}

      {isReady ? (
        <div className="flex gap-2">
          <Button type="button" onClick={onSubmit} disabled={sending} className="min-h-[40px]">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Sending…" : "Send voice note"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => recorder.reset()}
            disabled={sending}
            className="min-h-[40px]"
          >
            Re-record
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Decorative bars driven by an interval — the R20 spec defers real
 * audio metering. 24 bars re-randomised every 120 ms matches mobile's
 * visual density.
 */
function Waveform({ active }: { active: boolean }) {
  const BAR_COUNT = 24;
  const [bars, setBars] = React.useState<number[]>(
    () => Array.from({ length: BAR_COUNT }, () => 6)
  );
  React.useEffect(() => {
    if (!active) return;
    const handle = window.setInterval(() => {
      setBars((prev) => prev.map(() => 4 + Math.floor(Math.random() * 18)));
    }, 120);
    return () => window.clearInterval(handle);
  }, [active]);
  return (
    <div className="flex h-[22px] items-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-primary transition-[height] duration-100"
          style={{
            height: active ? h : 6,
            opacity: active ? 0.85 - (i % 5) * 0.07 : 0.3
          }}
        />
      ))}
    </div>
  );
}

function PhotoSurface({
  inputRef,
  file,
  preview,
  onChange,
  onSubmit,
  sending
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  preview: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  sending: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <label
        htmlFor="refine-photo-input"
        className={cn(
          "flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground transition hover:text-foreground",
          preview && "border-solid border-[var(--border)] p-2"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected photo"
            className="max-h-[240px] w-full rounded-md object-contain"
          />
        ) : (
          <>
            <Camera className="h-8 w-8 opacity-40" />
            <span className="text-[12.5px]">Snap a change · handwritten note or recipe page</span>
          </>
        )}
      </label>
      <input
        ref={inputRef}
        id="refine-photo-input"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        capture="environment"
        className="sr-only"
        onChange={onChange}
      />
      {file ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={sending}
            className="min-h-[40px] flex-1"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Analysing…" : "Send photo"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ─── History block ────────────────────────────────────────── */

type SessionTurn = {
  id: string;
  position: number;
  source: RefineSource;
  prompt: string;
  attachmentUrl: string | null;
  proposed: PendingChange[];
  accepted: boolean;
  createdAt: Date | string;
};

function TurnBlock({
  turn,
  resolverCtx,
  onTogglePress
}: {
  turn: SessionTurn;
  resolverCtx: React.ComponentProps<typeof TurnSummary>["resolverCtx"];
  onTogglePress: (turnId: string, currentAccepted: boolean) => void;
}) {
  const SourceIcon = SOURCE_ICON[turn.source];
  const rejected = !turn.accepted;
  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <div className="flex max-w-[78%] items-start gap-2 rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
          <SourceIcon className="mt-0.5 h-3.5 w-3.5 opacity-80" />
          <p className="text-[14px] leading-snug">{turn.prompt}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onTogglePress(turn.id, turn.accepted)}
        aria-label={rejected ? "Accept these changes" : "Reject these changes"}
        className={cn(
          "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition",
          rejected ? "opacity-60" : "opacity-100"
        )}
      >
        <TurnSummary turn={turn} resolverCtx={resolverCtx} rejected={rejected} />
      </button>
    </div>
  );
}

function TurnSummary({
  turn,
  resolverCtx,
  rejected
}: {
  turn: SessionTurn;
  resolverCtx: Parameters<typeof describePendingChange>[1];
  rejected: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]",
            rejected ? "text-muted-foreground" : "text-[color:var(--secondary-foreground)]"
          )}
        >
          <Sparkles className="h-3 w-3" />
          {rejected ? "Rejected" : "Proposed"} · {turn.proposed.length} change
          {turn.proposed.length === 1 ? "" : "s"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {rejected ? "Tap to accept" : "Tap to reject"}
        </span>
      </div>
      {turn.proposed.length === 0 ? (
        <p className="text-[12.5px] italic text-muted-foreground">
          No changes proposed for this turn.
        </p>
      ) : (
        <ul className="grid list-none gap-1">
          {turn.proposed.map((change) => {
            const d = describePendingChange(change, resolverCtx);
            return (
              <li key={change.id} className="grid gap-0.5">
                <span className="text-[13px] font-medium text-foreground">
                  {d.title}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {d.typeLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Discard ──────────────────────────────────────────────── */

function DiscardButton({
  onConfirm,
  pending,
  dirty
}: {
  onConfirm: () => void;
  pending: boolean;
  dirty: boolean;
}) {
  if (!dirty) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onConfirm}
        disabled={pending}
        className="min-h-[44px]"
      >
        Cancel
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" disabled={pending} className="min-h-[44px] text-destructive">
          Discard
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard all refinements?</AlertDialogTitle>
          <AlertDialogDescription>
            This closes the session and drops every pending change. The original
            recipe stays as it was.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep refining</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
