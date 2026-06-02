"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Camera,
  FileText,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  Mic,
  Sparkles
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MealLogForm } from "@/components/forms/meal-log-form";
import { SectionLabel } from "@/components/ui/section-label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import {
  SUPPORTED_AUDIO_MEDIA_TYPES
} from "@eeatly/api/validators/ai";
import { blobToBase64, useVoiceRecorder } from "@/lib/refine/use-voice-recorder";
import { cn } from "@/lib/utils";
import type { MealSuggestion } from "@/types";

/**
 * Round 29 — Capture with AI page.
 *
 * Two-phase flow on a single route:
 *   1. Capture phase — mode tabs (Photo / Text / Voice / Link) +
 *      input surface + "Extract recipe" TopBar action. Submits to
 *      the matching `ai.suggest*` procedure.
 *   2. Review phase — same page swaps to `<MealLogForm>` pre-filled
 *      with the extracted `MealSuggestion`. TopBar action changes to
 *      "Save meal".
 *
 * Mirrors the existing `<AiSuggestDialog>` semantics (mode tabs,
 * MediaRecorder via `useVoiceRecorder`, base64 wire, server-side
 * suggestion shape) but lifts the chrome to a full-page editorial
 * surface. The dialog stays available for in-context use; consumers
 * that need a modal entry haven't been migrated.
 *
 * Link mode renders as a fourth tab with a "Coming soon" surface —
 * no `ai.suggestFromLink` procedure exists today. Selecting the tab
 * doesn't navigate or enable extraction; the user picks a different
 * mode to proceed. Flagged.
 */

type Mode = "photo" | "text" | "voice" | "link";

const MODE_LABELS: Record<Mode, string> = {
  photo: "Photo",
  text: "Text",
  voice: "Voice",
  link: "Link"
};

const MODE_ICONS: Record<Mode, React.ElementType> = {
  photo: Camera,
  text: FileText,
  voice: Mic,
  link: LinkIcon
};

function mimeToExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export function CaptureAiClient() {
  const router = useRouter();
  const { showToast } = useToast();

  const [mode, setMode] = React.useState<Mode>("photo");
  const [suggestion, setSuggestion] = React.useState<MealSuggestion | null>(
    null
  );

  // Per-mode local state
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = React.useState("");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  const recorder = useVoiceRecorder();

  // Photo preview URL — derived once per file via useMemo, with a
  // cleanup-on-unmount effect that revokes the blob URL. The
  // setState-in-effect rule means we can't `setPreview(null)` from
  // an effect, so we use a memo for derivation + a separate effect
  // purely for revocation.
  const photoPreviewUrl = React.useMemo(() => {
    if (!photoFile) return null;
    return URL.createObjectURL(photoFile);
  }, [photoFile]);
  React.useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const voiceMutation = trpc.ai.suggestFromVoice.useMutation();

  const isPending =
    photoMutation.isPending ||
    textMutation.isPending ||
    voiceMutation.isPending;

  const voicePayloadReady = Boolean(
    audioFile || (recorder.state === "ready" && recorder.blob)
  );

  const canExtract = (() => {
    if (suggestion) return false;
    if (mode === "photo") return Boolean(photoFile) && !isPending;
    if (mode === "text") return textInput.trim().length > 0 && !isPending;
    if (mode === "voice") return voicePayloadReady && !isPending;
    return false; // link
  })();

  async function handleExtract() {
    try {
      if (mode === "photo" && photoFile) {
        const imageBase64 = await blobToBase64(photoFile);
        const result = await photoMutation.mutateAsync({
          imageBase64,
          mediaType: photoFile.type as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp"
        });
        setSuggestion(result);
      } else if (mode === "text" && textInput.trim().length > 0) {
        const result = await textMutation.mutateAsync({ text: textInput });
        setSuggestion(result);
      } else if (mode === "voice") {
        let blob: Blob | null = null;
        let mediaType = "";
        let fileName = "";
        if (audioFile) {
          blob = audioFile;
          mediaType = audioFile.type;
          fileName = audioFile.name;
        } else if (recorder.blob) {
          blob = recorder.blob;
          mediaType = recorder.blob.type;
          fileName = `voice-note.${mimeToExtension(recorder.blob.type)}`;
        }
        if (!blob) return;
        const audioBase64 = await blobToBase64(blob);
        const result = await voiceMutation.mutateAsync({
          audioBase64,
          mediaType: mediaType as (typeof SUPPORTED_AUDIO_MEDIA_TYPES)[number],
          fileName
        });
        setSuggestion(result);
      }
    } catch (err) {
      const cause = getCause(err);
      const reason = cause?.reason;
      const message = err instanceof Error ? err.message : "Try again.";
      if (reason === "RATE_LIMITED") {
        showToast({
          variant: "error",
          title: "AI limit reached",
          description: "Try again tomorrow."
        });
      } else if (reason === "UPGRADE_REQUIRED") {
        showToast({
          variant: "error",
          title: "Upgrade required",
          description: message
        });
      } else {
        showToast({
          variant: "error",
          title: "Couldn't extract recipe",
          description: message
        });
      }
    }
  }

  // TopBar action shifts between Capture and Review phases.
  const formId = React.useId();
  const externalFormId = `${formId}-capture-ai-form`;

  // Review phase — pre-filled form on the same page.
  if (suggestion) {
    return (
      <div className="grid gap-7">
        {/* Primary actions live in the page header (not the top bar). */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <p
              className="font-serif text-[20px] italic text-muted-foreground sm:text-[22px]"
              style={{ letterSpacing: "-0.005em" }}
            >
              Caught it,
            </p>
            <h1
              className="font-serif text-[40px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[60px]"
              style={{ letterSpacing: "-0.025em" }}
            >
              review &amp; save.
            </h1>
            <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
              The AI guessed the recipe from your input. Tweak anything that
              doesn&apos;t match, then save it to your library.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="min-h-[40px]"
              onClick={() => {
                setSuggestion(null);
                setPhotoFile(null);
                setTextInput("");
                setAudioFile(null);
                recorder.reset();
              }}
            >
              Start over
            </Button>
            <Button type="submit" form={externalFormId} variant="default" className="min-h-[40px]">
              Save meal
            </Button>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-3">
            <SectionLabel
              action={
                <Badge variant="sage">
                  Confidence: {suggestion.confidence}
                </Badge>
              }
            >
              Extracted draft
            </SectionLabel>
            <MealLogForm
              formId={externalFormId}
              hideSubmit
              initialMealName={suggestion.name}
              autoFocusRecipe
              onSuccess={() => router.push("/home" as Route)}
            />
            {/* MealLogForm doesn't accept prefill for effort / notes /
                recipeText via props today — the existing AI dialog
                feeds those via `form.setValue` after the dialog
                closes. For R29 the page passes the meal name; the
                rest the user fills in. A future pass can wire deeper
                prefill once MealLogForm exposes a `prefill` prop. */}
          </div>
          <aside className="grid gap-3">
            <Card className="bg-[color:var(--sage-soft)] p-5">
              <SectionLabel>What we got</SectionLabel>
              <dl className="mt-3 grid gap-2 text-[13px]">
                <div>
                  <dt className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.13em" }}>
                    Name
                  </dt>
                  <dd className="font-medium text-foreground">
                    {suggestion.name}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.13em" }}>
                    Effort guess
                  </dt>
                  <dd className="text-foreground">{suggestion.effortGuess}</dd>
                </div>
                {suggestion.notes ? (
                  <div>
                    <dt
                      className="font-mono text-[10.5px] uppercase text-muted-foreground"
                      style={{ letterSpacing: "0.13em" }}
                    >
                      Notes
                    </dt>
                    <dd className="text-foreground">{suggestion.notes}</dd>
                  </div>
                ) : null}
                {suggestion.ingredients && suggestion.ingredients.length > 0 ? (
                  <div>
                    <dt
                      className="font-mono text-[10.5px] uppercase text-muted-foreground"
                      style={{ letterSpacing: "0.13em" }}
                    >
                      {suggestion.ingredients.length} ingredients
                    </dt>
                    <dd className="text-foreground">
                      {suggestion.ingredients.slice(0, 5).join(", ")}
                      {suggestion.ingredients.length > 5 ? "…" : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  // Capture phase — mode tabs + input surface
  return (
    <div className="grid gap-7">
      {/* Primary action lives in the page header (not the top bar). */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <p
            className="font-serif text-[20px] italic text-muted-foreground sm:text-[22px]"
            style={{ letterSpacing: "-0.005em" }}
          >
            Tell us about it,
          </p>
          <h1
            className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[56px] lg:text-[64px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            we&apos;ll do the typing.
          </h1>
          <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
            Drop a photo of a handwritten card, paste a recipe URL, or
            record a voice note. AI extracts the structured recipe.
          </p>
        </div>
        <Button
          variant="default"
          className="min-h-[40px] shrink-0"
          onClick={handleExtract}
          disabled={!canExtract}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isPending ? "Extracting…" : "Extract recipe"}
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {/* Mode tabs */}
          <nav
            aria-label="Capture mode"
            className="flex flex-wrap items-center gap-2 rounded-full border bg-[var(--surface-2)] p-1"
          >
            {(["photo", "text", "voice", "link"] as Mode[]).map((m) => {
              const Icon = MODE_ICONS[m];
              const active = mode === m;
              const isLink = m === "link";
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground",
                    isLink ? "opacity-80" : ""
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {MODE_LABELS[m]}
                  {isLink ? (
                    <span
                      className="font-mono text-[9.5px] uppercase opacity-70"
                      style={{ letterSpacing: "0.13em" }}
                    >
                      soon
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Photo surface */}
          {mode === "photo" ? (
            <PhotoSurface
              file={photoFile}
              previewUrl={photoPreviewUrl}
              inputRef={photoInputRef}
              onPick={(file) => setPhotoFile(file)}
              onClear={() => {
                setPhotoFile(null);
                if (photoInputRef.current) photoInputRef.current.value = "";
              }}
            />
          ) : null}

          {/* Text surface */}
          {mode === "text" ? (
            <Card className="p-5">
              <SectionLabel className="mb-3">Paste the recipe</SectionLabel>
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={10}
                placeholder="Paste a recipe — ingredient list, instructions, or a screenshot OCR'd. The more context, the better the extraction."
                className="font-serif text-[15px] leading-[1.6] italic placeholder:italic"
              />
              <p className="mt-2 font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.13em" }}>
                {textInput.length.toLocaleString()} characters
              </p>
            </Card>
          ) : null}

          {/* Voice surface */}
          {mode === "voice" ? (
            <VoiceSurface
              recorder={recorder}
              audioFile={audioFile}
              audioInputRef={audioInputRef}
              onPickFile={(file) => setAudioFile(file)}
              onClearFile={() => {
                setAudioFile(null);
                if (audioInputRef.current) audioInputRef.current.value = "";
              }}
            />
          ) : null}

          {/* Link surface — placeholder per skip pattern */}
          {mode === "link" ? (
            <Card className="p-6">
              <SectionLabel>Link mode</SectionLabel>
              <p className="mt-3 text-[13.5px] leading-[1.55] text-muted-foreground">
                Pasting a URL to extract a recipe is coming soon. For
                now, paste the recipe text from the page in{" "}
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className="underline-offset-2 hover:underline text-primary"
                >
                  Text mode
                </button>
                .
              </p>
            </Card>
          ) : null}

          {/* "Try one" — decorative examples per design */}
          <div className="grid gap-3">
            <SectionLabel>Try one</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              <ExampleCard
                title="Photo of nani's recipe card"
                subtitle="Handwritten + faded — AI handles the OCR"
              />
              <ExampleCard
                title="WhatsApp voice note from mom"
                subtitle="Talk it through; we'll transcribe + structure"
              />
            </div>
          </div>
        </div>

        {/* Tips + privacy sidebar */}
        <aside className="grid gap-3">
          <Card
            className="bg-[color:var(--sage-soft)] p-5"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <SectionLabel className="text-primary">
                For sharper results
              </SectionLabel>
            </div>
            <ul className="mt-3 grid gap-2 text-[12.5px] leading-[1.55] text-foreground/85">
              <li>· Photos: bright, even light. Handwriting reads better than glare.</li>
              <li>· Text: include the ingredient list AND instructions when you can.</li>
              <li>· Voice: short pauses between steps help the model segment.</li>
              <li>· Recipes in any language — extraction works on most major ones.</li>
            </ul>
          </Card>
          <Card className="p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <SectionLabel>Privacy</SectionLabel>
            <p className="mt-3 text-[12.5px] leading-[1.55] text-muted-foreground">
              Captures are processed only to build your recipe — we
              don&apos;t train on your kitchen. Originals stay in your
              library, deletable any time.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function PhotoSurface({
  file,
  previewUrl,
  inputRef,
  onPick,
  onClear
}: {
  file: File | null;
  previewUrl: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  if (file && previewUrl) {
    return (
      <Card className="overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt=""
          className="w-full max-h-[420px] object-contain bg-[var(--surface-2)]"
        />
        <div className="flex items-center justify-between gap-2 border-t bg-[var(--surface)] px-5 py-3">
          <span className="truncate text-[13px] text-muted-foreground">
            {file.name}
          </span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Replace
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card
      className="relative grid min-h-[280px] cursor-pointer place-items-center overflow-hidden border-dashed bg-[var(--surface-2)] p-8 transition-colors hover:border-primary"
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0];
          if (next) onPick(next);
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 14px)"
        }}
      />
      <div className="relative grid place-items-center gap-3 text-center">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Camera className="h-6 w-6" />
        </span>
        <h3
          className="font-serif text-[28px] leading-tight text-foreground"
          style={{ letterSpacing: "-0.02em" }}
        >
          Drop a recipe photo
        </h3>
        <p className="max-w-[360px] text-[13px] text-muted-foreground">
          Recipe card, magazine page, restaurant menu — AI extracts the
          ingredients and steps.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="default"
            size="sm"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Choose file
          </Button>
        </div>
      </div>
    </Card>
  );
}

function VoiceSurface({
  recorder,
  audioFile,
  audioInputRef,
  onPickFile,
  onClearFile
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  audioFile: File | null;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onClearFile: () => void;
}) {
  const {
    state,
    seconds,
    supported,
    errorMessage,
    start,
    stop,
    reset
  } = recorder;
  return (
    <Card className="grid gap-4 p-6">
      <SectionLabel>Record or upload a voice note</SectionLabel>
      {supported ? (
        <div className="flex flex-wrap items-center gap-3">
          {state === "recording" ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px]"
              onClick={stop}
            >
              Stop · {seconds}s
            </Button>
          ) : state === "ready" ? (
            <>
              <Badge variant="sage" className="font-mono">
                {seconds}s recorded
              </Badge>
              <Button
                type="button"
                variant="outline"
                className="min-h-[40px]"
                onClick={reset}
              >
                Re-record
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="default"
              className="min-h-[44px]"
              onClick={start}
              disabled={state === "requesting"}
            >
              <Mic className="h-3.5 w-3.5" />
              {state === "requesting" ? "Asking…" : "Start recording"}
            </Button>
          )}
          {errorMessage ? (
            <p className="text-[12.5px] text-destructive">{errorMessage}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] italic text-muted-foreground">
          Recording isn&apos;t supported in this browser. Upload a voice
          file instead.
        </p>
      )}
      <div className="grid gap-2 border-t pt-4">
        <SectionLabel>Or upload</SectionLabel>
        {audioFile ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] text-foreground">
              {audioFile.name}
            </span>
            <Button variant="ghost" size="sm" onClick={onClearFile}>
              Clear
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="self-start min-h-[40px]"
            onClick={() => audioInputRef.current?.click()}
          >
            Choose file
          </Button>
        )}
        <input
          ref={audioInputRef}
          type="file"
          accept={SUPPORTED_AUDIO_MEDIA_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next) onPickFile(next);
          }}
        />
      </div>
    </Card>
  );
}

function ExampleCard({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Card
      className="cursor-default p-4"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <p
        className="font-serif text-[16px] leading-tight text-foreground"
        style={{ letterSpacing: "-0.01em" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
        {subtitle}
      </p>
    </Card>
  );
}
