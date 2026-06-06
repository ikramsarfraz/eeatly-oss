"use client";

import "../../app/assist.css";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { useToast } from "@/components/providers/toast-provider";
import { useCreateMealLogImperative } from "@/hooks/use-dashboard-meals";
import { uploadPhoto } from "@/lib/uploads/upload-photo";
import { blobToBase64 } from "@/lib/refine/use-voice-recorder";
import { SUPPORTED_AUDIO_MEDIA_TYPES } from "@eeatly/api/validators/ai";
import type { EffortLevel, MealSuggestion } from "@/types";

import { AssistBar } from "./assist-bar";
import { EffortPills } from "./effort-pills";
import { AeButton, AeInput, AeTextarea, AeDivider, Lbl } from "./field-atoms";
import { Camera, Check } from "./assist-icons";

type ImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Add a meal — "Assist" redesign. Manual entry is always the surface; the AI
 * Assist Bar pours a photo / voice / text / link into the same fields. Replaces
 * the old `/add` composer (and the "credits left" + tip side panels).
 */
export function AddAssistClient({ initialMealName }: { initialMealName?: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [mealName, setMealName] = React.useState(initialMealName ?? "");
  const [effort, setEffort] = React.useState<EffortLevel>("easy");
  const [cookedDate, setCookedDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // AI-poured fields (carried into the saved meal, reviewed via the recipe page).
  const [recipeText, setRecipeText] = React.useState("");
  const [ingredients, setIngredients] = React.useState<string[]>([]);
  const [servings, setServings] = React.useState("");
  const [recipeSourceUrl, setRecipeSourceUrl] = React.useState("");
  const [recipeGenerated, setRecipeGenerated] = React.useState(false);
  const [nameError, setNameError] = React.useState(false);

  const utils = trpc.useUtils();
  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const voiceMutation = trpc.ai.suggestFromVoice.useMutation();
  const create = useCreateMealLogImperative();
  const [saving, setSaving] = React.useState(false);

  function pour(s: MealSuggestion) {
    if (s.name) setMealName(s.name);
    setEffort(s.effortGuess);
    if (s.notes) setNotes(s.notes);
    setRecipeText(s.recipeText ?? "");
    setIngredients(s.ingredients ?? []);
    setServings(s.servings ?? "");
    setRecipeGenerated(Boolean(s.generated));
    setNameError(false);
    void utils.credits.balance.invalidate();
  }

  function onExtractError(err: unknown) {
    const reason = getCause(err)?.reason;
    showToast({
      variant: "error",
      title:
        reason === "RATE_LIMITED"
          ? "AI limit reached"
          : reason === "UPGRADE_REQUIRED"
            ? "Upgrade required"
            : "Couldn't read that",
      description:
        reason === "RATE_LIMITED"
          ? "Try again tomorrow."
          : err instanceof Error
            ? err.message
            : "Please try again."
    });
  }

  const runPhoto = async (file: File) => {
    try {
      const imageBase64 = await blobToBase64(file);
      pour(await photoMutation.mutateAsync({ imageBase64, mediaType: file.type as ImageMime }));
    } catch (err) {
      onExtractError(err);
      throw err;
    }
  };
  const runText = async (text: string) => {
    try {
      pour(await textMutation.mutateAsync({ text }));
    } catch (err) {
      onExtractError(err);
      throw err;
    }
  };
  const runVoice = async (audio: Blob, fileName: string) => {
    try {
      const audioBase64 = await blobToBase64(audio);
      pour(
        await voiceMutation.mutateAsync({
          audioBase64,
          mediaType: audio.type as (typeof SUPPORTED_AUDIO_MEDIA_TYPES)[number],
          fileName
        })
      );
    } catch (err) {
      onExtractError(err);
      throw err;
    }
  };
  const runLink = async (url: string) => {
    // No URL-extraction backend yet — capture the source link onto the meal so
    // it's saved with the recipe (the recipe view renders it as an embed).
    setRecipeSourceUrl(url.trim());
    showToast({ variant: "success", title: "Link saved to your meal" });
  };

  async function save() {
    if (mealName.trim().length < 2) {
      setNameError(true);
      showToast({ variant: "error", title: "Add a meal name first" });
      return;
    }
    setSaving(true);
    try {
      const photoUrl = photoFile ? await uploadPhoto(photoFile) : "";
      const result = await create.mutateAsync({
        mealName: mealName.trim(),
        effortLevel: effort,
        cookedDate,
        photoUrl,
        notes: notes.trim(),
        recipeText: recipeText.trim(),
        recipeSourceUrl: recipeSourceUrl.trim(),
        servings: servings.trim(),
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        recipeGenerated
      });
      showToast({ variant: "success", title: "Meal saved" });
      router.push((result?.mealId ? `/meal/${result.mealId}` : "/library") as Route);
    } catch (err) {
      showToast({
        variant: "error",
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please try again."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ae-scope mx-auto w-full max-w-[680px] pb-24 sm:pb-2">
      <h1 className="mb-2 font-[family-name:var(--ae-display)] text-[40px] leading-none tracking-[-0.025em] text-[color:var(--ae-ink)] sm:text-[46px]">
        Add a meal
      </h1>
      <p className="mb-[22px] max-w-[470px] text-[14.5px] leading-[1.5] text-[color:var(--ae-ink2)]">
        Fill it in below, or let AI do the typing from a photo, voice note, or link.
      </p>

      <AssistBar
        variant="add"
        title="Start from a photo, voice note, or link"
        sub="AI fills the fields below, you just review."
        cta="Use AI"
        runPhoto={runPhoto}
        runText={runText}
        runVoice={runVoice}
        runLink={runLink}
      />

      <AeDivider label="or write it in" />

      <div className="flex flex-col gap-[18px] rounded-[18px] border border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] p-[26px] shadow-[var(--ae-card-shadow)]">
        <div>
          <Lbl>Meal name</Lbl>
          <AeInput
            value={mealName}
            onChange={(e) => {
              setMealName(e.target.value);
              if (nameError) setNameError(false);
            }}
            placeholder="Lemon herb chicken bowls"
            style={nameError ? { borderColor: "var(--ae-danger)" } : undefined}
          />
        </div>

        <div>
          <Lbl>Effort</Lbl>
          <EffortPills value={effort} onChange={setEffort} />
        </div>

        <div className="grid grid-cols-2 gap-[14px]">
          <div>
            <Lbl>Cooked on</Lbl>
            <AeInput
              type="date"
              value={cookedDate}
              onChange={(e) => setCookedDate(e.target.value)}
              style={{ accentColor: "var(--ae-forest)" }}
            />
          </div>
          <div>
            <Lbl>Photo</Lbl>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex h-11 w-full items-center gap-2 truncate rounded-[11px] border border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] px-[14px] text-[14.5px] text-[color:var(--ae-ink3)]"
            >
              {photoFile ? (
                <>
                  <Check size={16} className="text-[color:var(--ae-accent)]" />
                  <span className="truncate text-[color:var(--ae-ink)]">{photoFile.name}</span>
                </>
              ) : (
                <>
                  <Camera size={16} /> Add photo
                </>
              )}
            </button>
          </div>
        </div>

        <div>
          <Lbl>
            Notes <span className="font-normal text-[color:var(--ae-ink3)]">· optional</span>
          </Lbl>
          <AeTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What made it worth remembering?"
            style={{ minHeight: 84 }}
          />
        </div>
      </div>

      {/* Web action row */}
      <div className="mt-[22px] hidden items-center justify-end gap-[10px] border-t border-[color:var(--ae-border-soft)] pt-[18px] sm:flex">
        <AeButton variant="ghost" onClick={() => router.back()}>
          Cancel
        </AeButton>
        <AeButton onClick={save} disabled={saving}>
          <Check size={16} /> {saving ? "Saving…" : "Save meal"}
        </AeButton>
      </div>

      {/* Mobile sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--ae-border)] bg-[color:var(--ae-cream)] p-3 sm:hidden">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[color:var(--ae-forest)] text-[15px] font-semibold text-[color:var(--ae-forest-text)] shadow-[var(--ae-cta-shadow)] disabled:opacity-60"
        >
          <Check size={17} /> {saving ? "Saving…" : "Save meal"}
        </button>
      </div>
    </div>
  );
}
