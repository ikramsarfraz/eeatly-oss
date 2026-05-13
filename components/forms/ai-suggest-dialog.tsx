"use client";

import * as React from "react";
import { Camera, FileText, Loader2, Sparkles } from "lucide-react";
import { suggestFromImageAction, suggestFromTextAction } from "@/actions/ai";
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
import type { MealSuggestion } from "@/types";

type Tab = "photo" | "text";

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
    }
  }

  async function handleSuggest() {
    setError(null);
    setIsPending(true);

    try {
      let suggestion: MealSuggestion;

      if (activeTab === "photo") {
        if (!photoFile) {
          setError("Please select an image first.");
          return;
        }
        const formData = new FormData();
        formData.append("image", photoFile);
        suggestion = await suggestFromImageAction(formData);
      } else {
        if (!pastedText.trim()) {
          setError("Please paste some text first.");
          return;
        }
        suggestion = await suggestFromTextAction(pastedText);
      }

      setOpen(false);
      onSuggestion(suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
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
          <DialogTitle>Fill from photo or text</DialogTitle>
          <DialogDescription>
            Upload a photo of the dish or recipe, or paste text. Claude will suggest the fields.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1">
          <button
            type="button"
            onClick={() => handleTabChange("photo")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all",
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all",
              activeTab === "text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Paste text
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

        {error && (
          <p className="text-[12.5px] text-destructive">{error}</p>
        )}

        <Button
          type="button"
          onClick={handleSuggest}
          disabled={isPending || (activeTab === "photo" ? !photoFile : !pastedText.trim())}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Suggest
            </>
          )}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          Photo and text are sent to AI providers (OpenAI, with Anthropic as fallback). Always review before saving.
        </p>
      </DialogContent>
    </Dialog>
  );
}
