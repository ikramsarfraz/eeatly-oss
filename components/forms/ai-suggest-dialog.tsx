"use client";

import * as React from "react";
import { Camera, FileText, Loader2, Sparkles, Youtube } from "lucide-react";
import {
  suggestFromImageAction,
  suggestFromTextAction,
  suggestFromYouTubeAction
} from "@/actions/ai";
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
import { classifyYoutubeUrl } from "@/lib/validators/ai";
import type { MealSuggestion } from "@/types";

type Tab = "photo" | "text" | "youtube";

type AiSuggestDialogProps = {
  onSuggestion: (suggestion: MealSuggestion) => void;
};

export function AiSuggestDialog({ onSuggestion }: AiSuggestDialogProps) {
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

  // Client-side URL classification — only enables the Suggest button
  // when the input looks reachable. Server still validates.
  const youtubeClassification = React.useMemo(
    () => (youtubeUrl ? classifyYoutubeUrl(youtubeUrl) : null),
    [youtubeUrl]
  );
  const youtubeUrlReady =
    youtubeClassification !== null && youtubeClassification.kind === "watch";

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
    }
  }

  async function handleSuggest() {
    setError(null);
    setSlowLoading(false);
    setIsPending(true);

    try {
      // Client-side gate so we don't burn a rate-limit slot on an obvious
      // mistake. The action also defends with INVALID_INPUT codes.
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

      // Each tab has a distinct result-shape (YouTube has 6 extra
      // codes). Branch first, then handle each result's union.
      if (activeTab === "photo" && photoFile) {
        const formData = new FormData();
        formData.append("image", photoFile);
        handleSuggestResult(await suggestFromImageAction(formData));
      } else if (activeTab === "text") {
        handleSuggestResult(await suggestFromTextAction(pastedText));
      } else if (activeTab === "youtube") {
        handleYouTubeResult(
          await suggestFromYouTubeAction({ url: youtubeUrl.trim() })
        );
      }
    } finally {
      setIsPending(false);
    }
  }

  function handleSuggestResult(
    result: Awaited<ReturnType<typeof suggestFromImageAction>>
  ) {
    if (result.ok) {
      setOpen(false);
      onSuggestion(result.data);
      return;
    }
    switch (result.code) {
      case "RATE_LIMITED":
        setError(result.message ?? "You've hit your daily AI limit.");
        break;
      case "INVALID_INPUT":
        setError(result.message ?? "We couldn't read that input.");
        break;
      case "AI_PROVIDER_ERROR":
        setError(result.message ?? "Something went wrong. Please try again.");
        break;
      case "UPGRADE_REQUIRED":
        setError(
          "AI assist is part of eeatly Plus. Visit /pricing to see what's included."
        );
        break;
    }
  }

  function handleYouTubeResult(
    result: Awaited<ReturnType<typeof suggestFromYouTubeAction>>
  ) {
    if (result.ok) {
      setOpen(false);
      onSuggestion(result.data);
      return;
    }
    // Each YouTube error code gets tailored copy. Generic "try again"
    // would be wrong here — Shorts won't work no matter how many times
    // the user retries.
    switch (result.code) {
      case "YOUTUBE_NO_TRANSCRIPT":
        setError(
          "This video doesn't have captions we can read. Try a different video, or paste the recipe text manually."
        );
        break;
      case "YOUTUBE_SHORTS_UNSUPPORTED":
        setError("YouTube Shorts don't work yet — try a regular video.");
        break;
      case "YOUTUBE_PLAYLIST_UNSUPPORTED":
        setError("This is a playlist link. Open one video and try its URL.");
        break;
      case "YOUTUBE_UNAVAILABLE":
        setError("Video isn't available — it may be private or removed.");
        break;
      case "YOUTUBE_AGE_RESTRICTED":
        setError("Age-restricted videos can't be read.");
        break;
      case "YOUTUBE_FETCH_FAILED":
        setError("Couldn't load the video right now. Try again in a minute.");
        break;
      case "INVALID_INPUT":
        setError(result.message ?? "That doesn't look like a YouTube link.");
        break;
      case "RATE_LIMITED":
        setError(result.message ?? "You've hit your daily AI limit.");
        break;
      case "UPGRADE_REQUIRED":
        setError(
          "YouTube recipe extraction is part of eeatly Plus. Visit /pricing to see what's included."
        );
        break;
      case "AI_PROVIDER_ERROR":
        setError(result.message ?? "Something went wrong. Please try again.");
        break;
    }
  }

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
          <DialogTitle>Fill from photo, text, or YouTube</DialogTitle>
          <DialogDescription>
            Upload a photo, paste recipe text, or drop a YouTube cooking video
            link. AI suggests the fields.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1">
          <button
            type="button"
            onClick={() => handleTabChange("photo")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all",
              activeTab === "youtube"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Youtube className="h-3.5 w-3.5" />
            YouTube
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
                : !youtubeUrlReady)
          }
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {activeTab === "youtube" ? "Reading the video…" : "Thinking…"}
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

        <p className="text-center text-[11px] text-muted-foreground">
          Inputs are sent to AI providers (OpenAI primary, Anthropic fallback).
          Always review before saving.
        </p>
      </DialogContent>
    </Dialog>
  );
}
