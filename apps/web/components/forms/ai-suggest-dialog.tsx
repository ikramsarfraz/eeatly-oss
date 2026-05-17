"use client";

import * as React from "react";
import { Camera, FileText, Loader2, Mic, Sparkles, Square, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  isSupportedAudioMediaType,
  MAX_AUDIO_UPLOAD_BYTES,
  SUPPORTED_AUDIO_MEDIA_TYPES
} from "@eeatly/api/validators/ai";
import { blobToBase64, useVoiceRecorder } from "@/lib/refine/use-voice-recorder";
import type { MealSuggestion } from "@/types";

type Tab = "photo" | "text" | "voice";
type VoiceMode = "record" | "upload";

type AiSuggestDialogProps = {
  onSuggestion: (suggestion: MealSuggestion) => void;
};

export function AiSuggestDialog({ onSuggestion }: AiSuggestDialogProps) {
  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const voiceMutation = trpc.ai.suggestFromVoice.useMutation();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("photo");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Photo tab state
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Text tab state
  const [pastedText, setPastedText] = React.useState("");

  // Slow-loading hint. Long voice notes can take a moment; honest copy
  // beats a stuck "Thinking…" spinner. The effect only schedules the
  // flip; the false-reset happens explicitly at the start of
  // `handleSuggest`.
  const [slowLoading, setSlowLoading] = React.useState(false);
  React.useEffect(() => {
    if (!isPending) return;
    const handle = window.setTimeout(() => setSlowLoading(true), 5000);
    return () => window.clearTimeout(handle);
  }, [isPending]);

  // Voice tab state. Two sub-modes — "record" uses MediaRecorder via
  // the shared `useVoiceRecorder` hook (R22 extraction), "upload"
  // accepts a file. The record path is hidden entirely if the browser
  // doesn't support MediaRecorder (older iOS, some embedded webviews)
  // and we auto-switch to upload mode.
  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>("record");
  const recorder = useVoiceRecorder();
  const {
    state: recordingState,
    blob: recordedBlob,
    url: recordedUrl,
    seconds: recordSeconds,
    supported: recorderSupported,
    errorMessage: recorderErrorMessage,
    start: recorderStart,
    stop: recorderStop,
    reset: recorderReset
  } = recorder;

  // Recorder errors compose with whatever the dialog's local `error`
  // already holds — computed during render so we don't trip the
  // setState-in-effect lint.
  const displayError = error ?? recorderErrorMessage;

  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  function resetVoiceState() {
    // Wipe the recording side via the hook, then clear the upload-side
    // state the dialog still owns (audioFile + the file input element).
    recorderReset();
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  function startRecording() {
    setError(null);
    void recorderStart();
  }

  function stopRecording() {
    recorderStop();
  }

  function cancelRecording() {
    resetVoiceState();
  }

  function handleAudioFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setAudioFile(null);
      return;
    }
    if (file.size === 0) {
      setError("That file is empty.");
      setAudioFile(null);
      return;
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setError("That file is too large. Try a shorter voice note (max 25 MB).");
      setAudioFile(null);
      return;
    }
    if (!isSupportedAudioMediaType(file.type)) {
      setError("Unsupported audio format. Try a different file (mp3, m4a, ogg, wav, webm).");
      setAudioFile(null);
      return;
    }
    setAudioFile(file);
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    setError(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Clean up on close
      setActiveTab("photo");
      setPhotoFile(null);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
      setPastedText("");
      setError(null);
      setIsPending(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
      resetVoiceState();
    }
  }

  async function handleSuggest() {
    setError(null);
    setSlowLoading(false);
    setIsPending(true);

    try {
      // Client-side gate so we don't burn a rate-limit slot on an obvious
      // mistake. The procedure also rejects with INVALID_INPUT shapes.
      if (activeTab === "photo" && !photoFile) {
        setError("Please select an image first.");
        return;
      }
      if (activeTab === "text" && !pastedText.trim()) {
        setError("Please paste some text first.");
        return;
      }
      if (activeTab === "voice" && !voicePayloadReady) {
        setError(
          voiceMode === "record"
            ? "Record a voice note first."
            : "Upload a voice note first."
        );
        return;
      }

      // Round 11: each tab calls its tRPC mutation. Binary inputs ride
      // as base64 strings in the JSON body — see the procedure-level
      // notes in `server/trpc/routers/ai.ts` for the trade-off.
      if (activeTab === "photo" && photoFile) {
        const imageBase64 = await blobToBase64(photoFile);
        try {
          const result = await photoMutation.mutateAsync({
            imageBase64,
            mediaType: photoFile.type as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp"
          });
          setOpen(false);
          onSuggestion(result);
        } catch (e) {
          handleAiError(e, "photo");
        }
      } else if (activeTab === "text") {
        try {
          const result = await textMutation.mutateAsync({
            text: pastedText
          });
          setOpen(false);
          onSuggestion(result);
        } catch (e) {
          handleAiError(e, "text");
        }
      } else if (activeTab === "voice") {
        let payload:
          | { blob: Blob; mediaType: string; fileName: string }
          | null = null;
        if (voiceMode === "record" && recordedBlob) {
          const extension = mimeToExtension(recordedBlob.type);
          payload = {
            blob: recordedBlob,
            mediaType: recordedBlob.type,
            fileName: `voice-note.${extension}`
          };
        } else if (voiceMode === "upload" && audioFile) {
          payload = {
            blob: audioFile,
            mediaType: audioFile.type,
            fileName: audioFile.name
          };
        }
        if (!payload) return;
        const audioBase64 = await blobToBase64(payload.blob);
        try {
          const result = await voiceMutation.mutateAsync({
            audioBase64,
            mediaType: payload.mediaType as (typeof SUPPORTED_AUDIO_MEDIA_TYPES)[number],
            fileName: payload.fileName
          });
          setOpen(false);
          onSuggestion(result);
        } catch (e) {
          handleAiError(e, "voice");
        }
      }
    } finally {
      setIsPending(false);
    }
  }

  /**
   * Single discriminator that handles all four tab paths. The cause's
   * `reason` is the wire-stable name we set in the AI router; the UI
   * copy is preserved verbatim from the Round 8 action.
   */
  function handleAiError(error: unknown, tab: Tab) {
    const cause = getCause(error);
    const reason = cause?.reason;
    const message = error instanceof Error ? error.message : undefined;

    if (reason === "RATE_LIMITED") {
      setError(message ?? "You've hit your daily AI limit.");
      return;
    }
    if (reason === "UPGRADE_REQUIRED") {
      if (tab === "voice") {
        setError(
          "Voice notes are part of eeatly Plus. Visit /pricing to see what's included."
        );
      } else {
        setError(
          "AI assist is part of eeatly Plus. Visit /pricing to see what's included."
        );
      }
      return;
    }
    if (reason === "INVALID_INPUT") {
      setError(message ?? "We couldn't read that input.");
      return;
    }
    if (tab === "voice") {
      switch (reason) {
        case "AUDIO_TOO_LARGE":
          setError("That file is too large. Try a shorter voice note (max 25 MB).");
          return;
        case "AUDIO_INVALID_FORMAT":
          setError("Unsupported audio format. Try a different file.");
          return;
        case "AUDIO_TRANSCRIPTION_FAILED":
          setError("Couldn't process the audio right now. Try again in a minute.");
          return;
        case "AUDIO_TOO_SHORT_OR_EMPTY":
          setError(
            "We couldn't hear a recipe in that audio. Try a longer recording or upload a different file."
          );
          return;
      }
    }
    setError(message ?? "Something went wrong. Please try again.");
  }

  const voicePayloadReady =
    voiceMode === "record" ? recordedBlob !== null : audioFile !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-[12.5px]">
          <Sparkles className="h-3.5 w-3.5" />
          Help me fill this out
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fill from photo, text, or voice</DialogTitle>
          <DialogDescription>
            Upload a photo, paste recipe text, or share a voice note. AI
            suggests the fields.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1">
          <button
            type="button"
            onClick={() => handleTabChange("photo")}
            className={cn(
              "flex min-w-[64px] flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
              activeTab === "photo"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            Photo
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("text")}
            className={cn(
              "flex min-w-[64px] flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
              activeTab === "text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Text
          </button>
          <button
            type="button"
            onClick={() => {
              handleTabChange("voice");
              // If the browser can't record, prefer upload mode by default
              // so the user isn't stuck staring at a disabled mic button.
              if (!recorderSupported) setVoiceMode("upload");
            }}
            className={cn(
              "flex min-w-[64px] flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
              activeTab === "voice"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            Voice
          </button>
        </div>

        {/* Photo tab */}
        {activeTab === "photo" && (
          <div className="grid gap-3">
            <label
              htmlFor="ai-photo-input"
              className={cn(
                "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--muted)] text-muted-foreground transition-colors hover:border-[var(--border-strong,#cfccc0)] hover:text-foreground",
                photoPreviewUrl && "border-solid border-[var(--border)] p-2"
              )}
            >
              {photoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl}
                  alt="Selected photo preview"
                  className="max-h-[200px] w-full rounded-md object-contain"
                />
              ) : (
                <>
                  <Camera className="h-8 w-8 opacity-40" />
                  <span className="text-[12.5px]">Tap to choose a photo</span>
                </>
              )}
            </label>
            <input
              ref={photoInputRef}
              id="ai-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              onChange={handlePhotoChange}
            />
            {photoFile && (
              <p className="truncate text-[11.5px] text-muted-foreground">{photoFile.name}</p>
            )}
          </div>
        )}

        {/* Text tab */}
        {activeTab === "text" && (
          <div className="grid gap-2">
            <Textarea
              placeholder="Paste a recipe, meal name, or any text about the dish…"
              className="min-h-[160px] resize-none text-[13px]"
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                setError(null);
              }}
              disabled={isPending}
            />
          </div>
        )}

        {/* Voice tab */}
        {activeTab === "voice" && (
          <div className="grid gap-3">
            {recorderSupported && (
              <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--muted)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceMode("record");
                    setError(null);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-medium transition-all",
                    voiceMode === "record"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Mic className="h-3 w-3" />
                  Record
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceMode("upload");
                    setError(null);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-medium transition-all",
                    voiceMode === "upload"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </button>
              </div>
            )}

            {!recorderSupported && (
              <p className="text-[11.5px] text-muted-foreground">
                Recording isn&apos;t supported in this browser — upload a voice
                note file instead.
              </p>
            )}

            {voiceMode === "record" && recorderSupported && (
              <div className="grid place-items-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] px-4 py-6">
                {recordingState === "idle" && (
                  <>
                    <button
                      type="button"
                      onClick={startRecording}
                      className="grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-[1.03] active:scale-[0.98]"
                      aria-label="Start recording"
                    >
                      <Mic className="h-8 w-8" />
                    </button>
                    <p className="text-center text-[12px] text-muted-foreground">
                      Tap to record a voice note. Describe the recipe in your
                      own words.
                    </p>
                  </>
                )}

                {recordingState === "requesting" && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Requesting microphone access…
                  </p>
                )}

                {recordingState === "recording" && (
                  <>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="grid h-20 w-20 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-[1.03] active:scale-[0.98] animate-pulse"
                      aria-label="Stop recording"
                    >
                      <Square className="h-7 w-7" fill="currentColor" />
                    </button>
                    <p className="text-center text-[14px] font-medium tabular-nums">
                      {formatDuration(recordSeconds)}
                    </p>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {recordingState === "ready" && recordedUrl && (
                  <>
                    <audio src={recordedUrl} controls className="w-full" />
                    <p className="text-[11.5px] text-muted-foreground">
                      {formatDuration(recordSeconds)} recorded
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        resetVoiceState();
                        startRecording();
                      }}
                      className="text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Re-record
                    </button>
                  </>
                )}

                {recordingState === "denied" && (
                  <button
                    type="button"
                    onClick={() => setVoiceMode("upload")}
                    className="text-[12px] underline-offset-2 hover:underline"
                  >
                    Switch to upload mode
                  </button>
                )}
              </div>
            )}

            {voiceMode === "upload" && (
              <div className="grid gap-2">
                <label
                  htmlFor="ai-audio-input"
                  className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--muted)] px-4 py-4 text-muted-foreground transition-colors hover:border-[var(--border-strong,#cfccc0)] hover:text-foreground"
                >
                  <Upload className="h-6 w-6 opacity-40" />
                  <span className="text-[12.5px]">
                    {audioFile ? audioFile.name : "Tap to choose an audio file"}
                  </span>
                  {audioFile && (
                    <span className="text-[11px] opacity-70">
                      {formatFileSize(audioFile.size)}
                    </span>
                  )}
                </label>
                <input
                  ref={audioInputRef}
                  id="ai-audio-input"
                  type="file"
                  accept={SUPPORTED_AUDIO_MEDIA_TYPES.join(",")}
                  className="sr-only"
                  onChange={handleAudioFileChange}
                />
                <p className="text-[11px] text-muted-foreground">
                  WhatsApp voice notes (mp3, m4a, opus, ogg) and regular audio
                  files up to 25 MB.
                </p>
              </div>
            )}
          </div>
        )}

        {displayError && (
          <p className="text-[12.5px] text-destructive">{displayError}</p>
        )}

        <Button
          type="button"
          onClick={handleSuggest}
          disabled={
            isPending ||
            (activeTab === "photo"
              ? !photoFile
              : activeTab === "text"
                ? !pastedText.trim()
                : !voicePayloadReady)
          }
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {activeTab === "voice" ? "Listening…" : "Thinking…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Suggest
            </>
          )}
        </Button>

        {isPending && activeTab === "voice" && slowLoading ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Long voice notes take a bit longer.
          </p>
        ) : null}

        <p className="text-center text-[11px] text-muted-foreground">
          Inputs are sent to AI providers (OpenAI primary, Anthropic fallback).
          Always review before saving.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// MediaRecorder picks the container based on browser support — map back
// to a sensible extension for the uploaded filename. Whisper uses the
// extension when the MIME is ambiguous, and the server-side validator
// expects a recognized type. Default to `webm` for unknown — that's the
// Chrome/Firefox default and the server-side validator accepts it.
function mimeToExtension(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}
