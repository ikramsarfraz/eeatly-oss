"use client";

import * as React from "react";
import { Camera, FileText, Loader2, Mic, Sparkles, Square, Upload, Youtube } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  classifyYoutubeUrl,
  isSupportedAudioMediaType,
  MAX_AUDIO_UPLOAD_BYTES,
  SUPPORTED_AUDIO_MEDIA_TYPES
} from "@/lib/validators/ai";
import type { MealSuggestion } from "@/types";

type Tab = "photo" | "text" | "youtube" | "voice";
type VoiceMode = "record" | "upload";

type AiSuggestDialogProps = {
  onSuggestion: (suggestion: MealSuggestion) => void;
};

/**
 * Convert binary `Blob` / `File` → base64 string suitable for the
 * tRPC procedure's JSON body. Read via `arrayBuffer()` (vs. `FileReader`)
 * for cleaner async flow; the result is a Node-style base64 string the
 * server-side `Buffer.from(_, 'base64')` decodes losslessly.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // btoa needs a binary string. For typical photo (a few MB) and voice
  // (up to 25 MB) sizes this stays well below the call-stack limit for
  // String.fromCharCode.apply(...); chunked when above 16k bytes.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function AiSuggestDialog({ onSuggestion }: AiSuggestDialogProps) {
  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const youtubeMutation = trpc.ai.suggestFromYouTube.useMutation();
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

  // YouTube tab state. `slowLoading` flips true after 5s of pending —
  // transcript fetches are slow when YouTube is degraded; honest copy
  // beats a stuck "Thinking…" spinner. The effect only schedules the
  // flip; the false-reset happens explicitly at the start of
  // `handleSuggest` (a setState inside the effect would trigger the
  // `set-state-in-effect` lint rule).
  const [youtubeUrl, setYoutubeUrl] = React.useState("");
  const [slowLoading, setSlowLoading] = React.useState(false);
  React.useEffect(() => {
    if (!isPending) return;
    const handle = window.setTimeout(() => setSlowLoading(true), 5000);
    return () => window.clearTimeout(handle);
  }, [isPending]);

  // Voice tab state. Two sub-modes — "record" uses MediaRecorder,
  // "upload" accepts a file. The record path is hidden entirely if the
  // browser doesn't support MediaRecorder (older iOS, some embedded
  // webviews) and we auto-switch to upload mode.
  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>("record");
  const [recordingState, setRecordingState] = React.useState<
    "idle" | "requesting" | "recording" | "ready" | "denied" | "error"
  >("idle");
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = React.useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const recordTimerRef = React.useRef<number | null>(null);
  const recorderSupported = React.useMemo(
    () => typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined",
    []
  );

  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  // Client-side URL classification — only enables the Suggest button
  // when the input looks reachable. Server still validates.
  const youtubeClassification = React.useMemo(
    () => (youtubeUrl ? classifyYoutubeUrl(youtubeUrl) : null),
    [youtubeUrl]
  );
  const youtubeUrlReady =
    youtubeClassification !== null && youtubeClassification.kind === "watch";

  function resetVoiceState() {
    // Stop any in-flight recording + release the mic. MediaRecorder.stop
    // is a no-op if not recording, but the tracks need an explicit stop
    // so the browser's red mic indicator goes away.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Already stopped — ignore.
      }
    }
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordSeconds(0);
    setRecordingState("idle");
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  async function startRecording() {
    if (!recorderSupported) {
      setRecordingState("error");
      setError("Recording isn't supported in this browser. Try uploading a file instead.");
      return;
    }
    setError(null);
    setRecordingState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        // `recorder.mimeType` is the browser's chosen container (typically
        // "audio/webm;codecs=opus" on Chrome/Firefox, "audio/mp4" on
        // recent Safari). Strip codec params for the Blob's type so the
        // server-side validator sees a recognized MIME.
        const rawMime = recorder.mimeType || "audio/webm";
        const cleanMime = rawMime.split(";")[0]?.trim() || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type: cleanMime });
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecordingState("ready");
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      });
      recorder.start();
      setRecordingState("recording");
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000
      );
    } catch {
      // Permission denied or unavailable mic — surface the path that
      // recovers (upload). NotAllowedError, SecurityError, NotFoundError
      // all converge here; the user-facing message is the same.
      setRecordingState("denied");
      setError(
        "We need microphone access to record. You can switch to upload mode instead."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
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
      setYoutubeUrl("");
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
      if (activeTab === "youtube" && !youtubeUrlReady) {
        setError("Paste a YouTube video link.");
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
      } else if (activeTab === "youtube") {
        try {
          const result = await youtubeMutation.mutateAsync({
            url: youtubeUrl.trim()
          });
          setOpen(false);
          onSuggestion(result);
        } catch (e) {
          handleAiError(e, "youtube");
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
      if (tab === "youtube") {
        setError(
          "YouTube recipe extraction is part of eeatly Plus. Visit /pricing to see what's included."
        );
      } else if (tab === "voice") {
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
    if (tab === "youtube") {
      switch (reason) {
        case "YOUTUBE_NO_TRANSCRIPT":
          setError(
            "This video doesn't have captions we can read. Try a different video, or paste the recipe text manually."
          );
          return;
        case "YOUTUBE_SHORTS_UNSUPPORTED":
          setError("YouTube Shorts don't work yet — try a regular video.");
          return;
        case "YOUTUBE_PLAYLIST_UNSUPPORTED":
          setError("This is a playlist link. Open one video and try its URL.");
          return;
        case "YOUTUBE_UNAVAILABLE":
          setError("Video isn't available — it may be private or removed.");
          return;
        case "YOUTUBE_AGE_RESTRICTED":
          setError("Age-restricted videos can't be read.");
          return;
        case "YOUTUBE_FETCH_FAILED":
          setError("Couldn't load the video right now. Try again in a minute.");
          return;
      }
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
          <DialogTitle>Fill from photo, text, video, or voice</DialogTitle>
          <DialogDescription>
            Upload a photo, paste recipe text, drop a YouTube cooking video link,
            or share a voice note. AI suggests the fields.
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
            onClick={() => handleTabChange("youtube")}
            className={cn(
              "flex min-w-[64px] flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
              activeTab === "youtube"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Youtube className="h-3.5 w-3.5" />
            YouTube
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

        {/* YouTube tab */}
        {activeTab === "youtube" && (
          <div className="grid gap-2">
            <Input
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError(null);
              }}
              disabled={isPending}
              autoComplete="off"
            />
            {youtubeClassification?.kind === "shorts" ? (
              <p className="text-[11.5px] text-amber-700">
                Shorts don&apos;t have captions we can read — try a regular video.
              </p>
            ) : youtubeClassification?.kind === "playlist" ? (
              <p className="text-[11.5px] text-amber-700">
                That&apos;s a playlist — open one video and use its URL.
              </p>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">
                Works best on full cooking videos. Shorts and playlists don&apos;t work.
              </p>
            )}
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

        {error && (
          <p className="text-[12.5px] text-destructive">{error}</p>
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
                : activeTab === "youtube"
                  ? !youtubeUrlReady
                  : !voicePayloadReady)
          }
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {activeTab === "youtube"
                ? "Reading the video…"
                : activeTab === "voice"
                  ? "Listening…"
                  : "Thinking…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Suggest
            </>
          )}
        </Button>

        {isPending && activeTab === "youtube" && slowLoading ? (
          <p className="text-center text-[11px] text-muted-foreground">
            This sometimes takes a moment for longer videos.
          </p>
        ) : null}

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
