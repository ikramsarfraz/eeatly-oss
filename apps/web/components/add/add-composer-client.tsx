"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Camera,
  FileText,
  Link as LinkIcon,
  Loader2,
  Mic,
  Sparkles,
  Utensils
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MealLogForm } from "@/components/forms/meal-log-form";
import { CreditUsageBar } from "@/components/credits/credit-usage-bar";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { SUPPORTED_AUDIO_MEDIA_TYPES } from "@eeatly/api/validators/ai";
import { blobToBase64, useVoiceRecorder } from "@/lib/refine/use-voice-recorder";
import { cn } from "@/lib/utils";
import type { MealSuggestion } from "@/types";

/**
 * Unified capture composer (`/add`) — the single capture door.
 *
 * One page; the input method is an in-place segmented control:
 *   - `log` — the manual `MealLogForm` (the inline AI dialog is hidden;
 *     AI now has its own tabs).
 *   - `photo` / `text` / `voice` — an AI input surface + "Extract recipe",
 *     which runs the existing `ai.suggest*` procedures and swaps the left
 *     card to the SAME `MealLogForm`, pre-filled for review.
 *   - `link` — placeholder until an `ai.suggestFromLink` procedure exists.
 *
 * Replaces the old `/add` hub, `/add/ai` page, and the in-form AI modal.
 * Save/Cancel live at the page bottom (the form's submit is lifted via
 * `formId`).
 */

export type CaptureMethod = "log" | "photo" | "text" | "voice" | "link";

const AI_METHODS: CaptureMethod[] = ["photo", "text", "voice", "link"];

const SEGMENTS: {
  id: CaptureMethod;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "log", label: "Log it", icon: Utensils },
  { id: "photo", label: "Photo", icon: Camera },
  { id: "text", label: "Text", icon: FileText },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "link", label: "Link", icon: LinkIcon }
];

const AI_TITLE: Record<"photo" | "text" | "voice" | "link", string> = {
  photo: "Drop a recipe photo",
  text: "Paste the recipe",
  voice: "Record a voice note",
  link: "Paste a link"
};
const AI_HINT: Record<"photo" | "text" | "voice" | "link", string> = {
  photo: "Dish photo or recipe card",
  text: "Name a dish, or paste a recipe",
  voice: "Talk it through",
  link: "YouTube · IG · URL"
};

function mimeToExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export function AddComposerClient({
  initialMethod = "log",
  initialMealName
}: {
  initialMethod?: CaptureMethod;
  initialMealName?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [method, setMethod] = React.useState<CaptureMethod>(initialMethod);
  const [suggestion, setSuggestion] = React.useState<MealSuggestion | null>(null);
  // Bumped on each extraction so the pre-filled MealLogForm remounts.
  const [reviewNonce, setReviewNonce] = React.useState(0);

  // AI input state.
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = React.useState("");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();

  const photoPreviewUrl = React.useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile]
  );
  React.useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const utils = trpc.useUtils();
  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const voiceMutation = trpc.ai.suggestFromVoice.useMutation();
  const isPending =
    photoMutation.isPending || textMutation.isPending || voiceMutation.isPending;

  const voicePayloadReady = Boolean(
    audioFile || (recorder.state === "ready" && recorder.blob)
  );
  const canExtract = (() => {
    if (method === "photo") return Boolean(photoFile) && !isPending;
    if (method === "text") return textInput.trim().length > 0 && !isPending;
    if (method === "voice") return voicePayloadReady && !isPending;
    return false; // link
  })();

  function switchMethod(next: CaptureMethod) {
    if (next === method) return;
    // Changing method abandons any in-progress review draft.
    setSuggestion(null);
    setMethod(next);
  }

  async function handleExtract() {
    try {
      let result: MealSuggestion | null = null;
      if (method === "photo" && photoFile) {
        const imageBase64 = await blobToBase64(photoFile);
        result = await photoMutation.mutateAsync({
          imageBase64,
          mediaType: photoFile.type as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp"
        });
      } else if (method === "text" && textInput.trim().length > 0) {
        result = await textMutation.mutateAsync({ text: textInput });
      } else if (method === "voice") {
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
        result = await voiceMutation.mutateAsync({
          audioBase64,
          mediaType: mediaType as (typeof SUPPORTED_AUDIO_MEDIA_TYPES)[number],
          fileName
        });
      }
      if (result) {
        setSuggestion(result);
        setReviewNonce((n) => n + 1);
        // Reflect the spend in the credit bar (server is source of truth).
        void utils.credits.balance.invalidate();
      }
    } catch (err) {
      const reason = getCause(err)?.reason;
      const message = err instanceof Error ? err.message : "Try again.";
      showToast({
        variant: "error",
        title:
          reason === "RATE_LIMITED"
            ? "AI limit reached"
            : reason === "UPGRADE_REQUIRED"
              ? "Upgrade required"
              : "Couldn't extract recipe",
        description: reason === "RATE_LIMITED" ? "Try again tomorrow." : message
      });
    }
  }

  const formId = React.useId();
  const externalFormId = `${formId}-add`;
  const isAi = AI_METHODS.includes(method);
  // The form shows for the log method, or once an AI extraction is in review.
  const showForm = method === "log" || suggestion !== null;
  const saveLabel = suggestion ? "Save recipe" : "Save meal";

  return (
    <div className="mx-auto grid w-full max-w-[920px] gap-6 pt-1">
      <header className="grid gap-2">
        <p
          className="font-mono text-[10.5px] uppercase text-[color:var(--terra-fg)]"
          style={{ letterSpacing: "0.16em" }}
        >
          Capture · Add
        </p>
        <h1
          className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[58px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Add to your kitchen
        </h1>
        <p className="max-w-[560px] text-[15px] leading-[1.55] text-muted-foreground">
          One place to capture. Log a meal you cooked, or let AI pull a recipe from a photo,
          text, voice note or link — it all lands in the same form.
        </p>
      </header>

      {/* Method switcher */}
      <div
        role="tablist"
        aria-label="Capture method"
        className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-[13px] border bg-[var(--surface-2)] p-1"
      >
        {SEGMENTS.map((seg) => {
          const Icon = seg.icon;
          const active = method === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMethod(seg.id)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-[15px] py-[9px] text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]",
                active
                  ? "bg-[color:var(--cta,var(--primary))] text-[color:var(--primary-foreground)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {seg.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-[22px] lg:grid-cols-[1fr_300px] lg:items-start">
        {/* Left: active method body */}
        {showForm ? (
          <Card className="p-6">
            {suggestion ? (
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                <Badge variant="sage">Extracted · review before saving</Badge>
              </div>
            ) : null}
            <MealLogForm
              key={suggestion ? `review-${reviewNonce}` : "log"}
              formId={externalFormId}
              hideSubmit
              hideAiSuggest
              initialSuggestion={suggestion ?? undefined}
              initialMealName={suggestion ? undefined : initialMealName}
              onSuccess={({ mealId }) =>
                router.push((mealId ? `/meal/${mealId}` : "/home") as Route)
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3">
            <CreditUsageBar />
            <AiSurface
            method={method as "photo" | "text" | "voice" | "link"}
            photoFile={photoFile}
            photoPreviewUrl={photoPreviewUrl}
            photoInputRef={photoInputRef}
            onPickPhoto={(f) => setPhotoFile(f)}
            onClearPhoto={() => {
              setPhotoFile(null);
              if (photoInputRef.current) photoInputRef.current.value = "";
            }}
            textInput={textInput}
            onText={setTextInput}
            recorder={recorder}
            audioFile={audioFile}
            audioInputRef={audioInputRef}
            onPickAudio={(f) => setAudioFile(f)}
            onClearAudio={() => {
              setAudioFile(null);
              if (audioInputRef.current) audioInputRef.current.value = "";
            }}
            canExtract={canExtract}
            isPending={isPending}
            onExtract={handleExtract}
            onSwitchToText={() => switchMethod("text")}
            />
          </div>
        )}

        {/* Right: tip card (changes with method) */}
        <Card
          className="bg-[color:var(--sage-soft)] p-5"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <p
            className="font-mono text-[10.5px] uppercase text-[color:var(--primary)]"
            style={{ letterSpacing: "0.14em" }}
          >
            {method === "log" ? "What gets remembered" : "For sharper results"}
          </p>
          <ul className="mt-3 grid gap-2 text-[13px] leading-[1.5] text-foreground/85">
            {(method === "log"
              ? [
                  "Cook count + last-cooked date roll up automatically.",
                  "Photos attach to the meal so future logs land on the same recipe.",
                  "Effort tags power the dashboard's “Tonight” picks."
                ]
              : [
                  "Bright, even light — handwriting beats glare.",
                  "Include ingredients AND steps when you can.",
                  "Any language — extraction works on most."
                ]
            ).map((line) => (
              <li key={line} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--primary)]"
                />
                {line}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Page action row */}
      <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-soft,var(--border))] pt-5">
        <Button variant="outline" className="min-h-[44px]" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={externalFormId}
          variant="default"
          className="min-h-[44px]"
          disabled={!showForm}
          title={
            isAi && !showForm ? "Extract a recipe first, then review and save" : undefined
          }
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/* ─── AI input surface ─────────────────────────────────────────── */

function AiSurface({
  method,
  photoFile,
  photoPreviewUrl,
  photoInputRef,
  onPickPhoto,
  onClearPhoto,
  textInput,
  onText,
  recorder,
  audioFile,
  audioInputRef,
  onPickAudio,
  onClearAudio,
  canExtract,
  isPending,
  onExtract,
  onSwitchToText
}: {
  method: "photo" | "text" | "voice" | "link";
  photoFile: File | null;
  photoPreviewUrl: string | null;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  onPickPhoto: (f: File) => void;
  onClearPhoto: () => void;
  textInput: string;
  onText: (v: string) => void;
  recorder: ReturnType<typeof useVoiceRecorder>;
  audioFile: File | null;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  onPickAudio: (f: File) => void;
  onClearAudio: () => void;
  canExtract: boolean;
  isPending: boolean;
  onExtract: () => void;
  onSwitchToText: () => void;
}) {
  if (method === "link") {
    return (
      <Card className="grid place-items-center gap-3 border-dashed bg-[var(--paper,var(--surface-2))] p-11 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)]">
          <LinkIcon className="h-6 w-6" />
        </span>
        <h3 className="font-serif text-[26px] leading-tight text-foreground">Paste a link</h3>
        <p className="max-w-[360px] text-[13.5px] leading-[1.5] text-muted-foreground">
          Extracting a recipe from a URL is coming soon. For now, paste the recipe text in{" "}
          <button
            type="button"
            onClick={onSwitchToText}
            className="text-[color:var(--primary)] underline-offset-2 hover:underline"
          >
            Text
          </button>
          .
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      <Card className="grid place-items-center gap-3 border-dashed bg-[var(--paper,var(--surface-2))] px-6 py-11 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)]">
          {method === "photo" ? (
            <Camera className="h-6 w-6" />
          ) : method === "text" ? (
            <FileText className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </span>
        <h3 className="font-serif text-[26px] leading-tight text-foreground">
          {AI_TITLE[method]}
        </h3>
        <p className="max-w-[360px] text-[13.5px] leading-[1.5] text-muted-foreground">
          {AI_HINT[method]}. AI fills in the ingredients and steps for you to review, generating
          a starting recipe when you only give a name.
        </p>

        {/* Per-method input */}
        {method === "photo" ? (
          <div className="grid w-full max-w-[440px] place-items-center gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (next) onPickPhoto(next);
              }}
            />
            {photoFile && photoPreviewUrl ? (
              <div className="flex w-full items-center justify-between gap-2 rounded-[10px] border bg-[var(--surface)] px-3 py-2 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreviewUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                  {photoFile.name}
                </span>
                <Button variant="ghost" size="sm" onClick={onClearPhoto}>
                  Replace
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
              >
                Choose file
              </Button>
            )}
          </div>
        ) : null}

        {method === "text" ? (
          <Textarea
            value={textInput}
            onChange={(e) => onText(e.target.value)}
            rows={6}
            placeholder="Name a dish (e.g. chicken biryani) or paste a full recipe. The more you give, the closer it is to yours."
            className="w-full max-w-[480px] text-left text-[14px] leading-[1.55]"
          />
        ) : null}

        {method === "voice" ? (
          <VoiceControls
            recorder={recorder}
            audioFile={audioFile}
            audioInputRef={audioInputRef}
            onPickAudio={onPickAudio}
            onClearAudio={onClearAudio}
          />
        ) : null}

        <Button
          variant="default"
          className="mt-1 min-h-[42px]"
          onClick={onExtract}
          disabled={!canExtract}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isPending ? "Extracting…" : "Extract recipe"}
        </Button>
      </Card>
      <p
        className="text-center font-mono text-[10.5px] uppercase text-muted-foreground"
        style={{ letterSpacing: "0.12em" }}
      >
        Extracted fields land in the same form — review before saving.
      </p>
    </div>
  );
}

function VoiceControls({
  recorder,
  audioFile,
  audioInputRef,
  onPickAudio,
  onClearAudio
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  audioFile: File | null;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  onPickAudio: (f: File) => void;
  onClearAudio: () => void;
}) {
  const { state, seconds, supported, errorMessage, start, stop, reset } = recorder;
  return (
    <div className="grid w-full max-w-[440px] gap-3">
      {supported ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {state === "recording" ? (
            <Button type="button" variant="destructive" className="min-h-[44px]" onClick={stop}>
              Stop · {seconds}s
            </Button>
          ) : state === "ready" ? (
            <>
              <Badge variant="sage" className="font-mono">
                {seconds}s recorded
              </Badge>
              <Button type="button" variant="outline" className="min-h-[40px]" onClick={reset}>
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
        </div>
      ) : (
        <p className="text-[13px] italic text-muted-foreground">
          Recording isn&apos;t supported here — upload a voice file instead.
        </p>
      )}
      {errorMessage ? (
        <p className="text-center text-[12.5px] text-destructive">{errorMessage}</p>
      ) : null}
      <div className="flex items-center justify-center gap-2">
        {audioFile ? (
          <>
            <span className="truncate text-[13px] text-foreground">{audioFile.name}</span>
            <Button variant="ghost" size="sm" onClick={onClearAudio}>
              Clear
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => audioInputRef.current?.click()}
          >
            Or upload a file
          </Button>
        )}
        <input
          ref={audioInputRef}
          type="file"
          accept={SUPPORTED_AUDIO_MEDIA_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next) onPickAudio(next);
          }}
        />
      </div>
    </div>
  );
}
