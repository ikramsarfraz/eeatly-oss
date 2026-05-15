"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, ChevronDown, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { AiSuggestDialog } from "@/components/forms/ai-suggest-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMealLogImperative } from "@/hooks/use-dashboard-meals";
import { endpoints, type PresignUploadResponse } from "@/lib/api/endpoints";
import { trpc } from "@/lib/trpc/client";
import { mealLogInputSchema, type MealLogInput } from "@/lib/validators/meals";
import { cn } from "@/lib/utils";
import type { MealSuggestion } from "@/types";

type MealLogFormProps = {
  onSuccess?: () => void;
  initialMealName?: string;
  autoFocusRecipe?: boolean;
};

const effortOptions: Array<{ value: MealLogInput["effortLevel"]; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High" }
];

async function uploadPhoto(file: File) {
  const presignResponse = await fetch(endpoints.uploads.presign(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type
    })
  });

  if (!presignResponse.ok) {
    const error = (await presignResponse.json()) as { error?: string };
    throw new Error(error.error ?? "Photo upload is not available yet.");
  }

  const { url, fields, publicUrl } = (await presignResponse.json()) as PresignUploadResponse;

  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }
  // Content-Type must be an explicit field to satisfy the policy condition.
  // The file must be appended last — S3/R2 presigned POST requires it.
  formData.append("Content-Type", file.type);
  formData.append("file", file);

  const uploadResponse = await fetch(url, {
    method: "POST",
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error("Unable to upload photo.");
  }

  return publicUrl;
}

export function MealLogForm({ onSuccess, initialMealName, autoFocusRecipe }: MealLogFormProps) {
  const datalistId = React.useId();
  const utils = trpc.useUtils();
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isRecipeOpen, setIsRecipeOpen] = React.useState(false);
  const [aiNotice, setAiNotice] = React.useState<{ confidence: MealSuggestion["confidence"] } | null>(null);
  const aiNoticeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const recipeTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Peek at the dashboard's tRPC cache for autocomplete + recipe
  // prefill. `getData()` is non-subscribing — re-renders only happen
  // when react-hook-form updates the watched mealName below.
  const cachedDashboard = utils.dashboard.meals.getData();
  const { mealNameSuggestions, mealDetailsByName } = React.useMemo(() => {
    const cached = cachedDashboard;
    if (!cached) return { mealNameSuggestions: [], mealDetailsByName: new Map<string, { recipeText: string | null; recipeSourceUrl: string | null }>() };

    const seen = new Set<string>();
    const names: string[] = [];
    const detailsMap = new Map<string, { recipeText: string | null; recipeSourceUrl: string | null }>();

    const add = (meal: { mealName: string; recipeText?: string | null; recipeSourceUrl?: string | null }) => {
      const key = meal.mealName.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        names.push(meal.mealName);
      }
      if (!detailsMap.has(key) && (meal.recipeText !== undefined || meal.recipeSourceUrl !== undefined)) {
        detailsMap.set(key, {
          recipeText: meal.recipeText ?? null,
          recipeSourceUrl: meal.recipeSourceUrl ?? null
        });
      }
    };

    for (const meal of cached.mostCookedMeals) add(meal);
    for (const meal of cached.neglectedMeals) add(meal);
    // recentMeals are per-log (no recipe data), add names only
    for (const meal of cached.recentMeals) {
      const key = meal.mealName.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        names.push(meal.mealName);
      }
    }

    return { mealNameSuggestions: names, mealDetailsByName: detailsMap };
  }, [cachedDashboard]);

  const form = useForm<MealLogInput>({
    resolver: zodResolver(mealLogInputSchema),
    defaultValues: {
      mealName: "",
      effortLevel: "easy",
      notes: "",
      cookedDate: new Date().toISOString().slice(0, 10),
      photoUrl: "",
      recipeText: "",
      recipeSourceUrl: "",
      ingredients: undefined
    }
  });

  const mealName = form.watch("mealName");

  function handleSuggestion(suggestion: MealSuggestion) {
    form.setValue("mealName", suggestion.name, { shouldValidate: true });
    form.setValue("effortLevel", suggestion.effortGuess, { shouldValidate: true });
    if (suggestion.notes) form.setValue("notes", suggestion.notes);
    if (suggestion.recipeText) {
      form.setValue("recipeText", suggestion.recipeText);
      setIsRecipeOpen(true);
    }
    // Round 10: AI-extracted ingredients ride alongside recipeText. The
    // form has no visible field for them — they pass through to the
    // server action and persist on the meals row, where the recipe-view
    // checklist (Task 3) reads them. We only set when the AI actually
    // returned some; empty arrays would null out existing ingredients
    // on the merge path and surprise the user.
    if (suggestion.ingredients && suggestion.ingredients.length > 0) {
      form.setValue("ingredients", suggestion.ingredients);
    }

    if (aiNoticeTimerRef.current) clearTimeout(aiNoticeTimerRef.current);
    setAiNotice({ confidence: suggestion.confidence });
    aiNoticeTimerRef.current = setTimeout(() => setAiNotice(null), 5000);
  }

  React.useEffect(() => {
    return () => {
      if (aiNoticeTimerRef.current) clearTimeout(aiNoticeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (initialMealName) {
      form.setValue("mealName", initialMealName, { shouldValidate: true });
    }
  }, [initialMealName, form]);

  React.useEffect(() => {
    if (autoFocusRecipe) {
      setIsRecipeOpen(true);
      const timer = setTimeout(() => recipeTextareaRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [autoFocusRecipe]);

  // Prefill recipe from cache when meal name matches an existing meal
  React.useEffect(() => {
    const key = mealName?.trim().toLowerCase();
    if (!key) return;
    const details = mealDetailsByName.get(key);
    if (!details) return;
    form.setValue("recipeText", details.recipeText ?? "");
    form.setValue("recipeSourceUrl", details.recipeSourceUrl ?? "");
    if (details.recipeText || details.recipeSourceUrl) {
      setIsRecipeOpen(true);
    }
  }, [mealName, mealDetailsByName, form]);

  const mutation = useCreateMealLogImperative();
  const isSubmitting = form.formState.isSubmitting || mutation.isPending;
  const selectedEffort = form.watch("effortLevel");

  function resetAfterSuccess() {
    form.reset({
      mealName: "",
      effortLevel: "easy",
      notes: "",
      cookedDate: new Date().toISOString().slice(0, 10),
      photoUrl: "",
      recipeText: "",
      recipeSourceUrl: "",
      ingredients: undefined
    });
    setPhotoFile(null);
    setFormError(null);
    setIsRecipeOpen(false);
    setAiNotice(null);
    if (aiNoticeTimerRef.current) clearTimeout(aiNoticeTimerRef.current);
    setSuccessMessage("Logged! Your meal has been saved.");
    onSuccess?.();
  }

  async function persist(values: MealLogInput) {
    const photoUrl = photoFile ? await uploadPhoto(photoFile) : values.photoUrl;
    await mutation.mutateAsync({
      ...values,
      photoUrl
    });
  }

  const handlePersist = form.handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);

    try {
      await persist(values);
      resetAfterSuccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to log meal.");
    }
  });

  return (
    <form
      className="grid gap-3"
      onSubmit={handlePersist}
      onKeyDown={(event) => {
        if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
          return;
        }

        const target = event.target as HTMLElement | null;
        if (!target?.closest("textarea, input:not([type=submit]):not([type=file]):not([type=hidden])")) {
          return;
        }

        if (target.closest("button")) {
          return;
        }

        event.preventDefault();
        void handlePersist();
      }}
    >
      {/* AI prefill */}
      <AiSuggestDialog onSuggestion={handleSuggestion} />

      {/* AI notice */}
      {aiNotice && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-[12.5px]",
            aiNotice.confidence === "low"
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-primary/20 bg-primary/10 text-primary"
          )}
        >
          {aiNotice.confidence === "low"
            ? "AI wasn't very confident — please double-check the fields."
            : "AI-suggested — please review before saving."}
        </div>
      )}

      {/* Meal name */}
      <div className="grid gap-[5px]">
        <label
          htmlFor="mealName"
          className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]"
        >
          Meal name
        </label>
        <Input
          id="mealName"
          placeholder="Lemon herb chicken bowls"
          list={mealNameSuggestions.length > 0 ? datalistId : undefined}
          disabled={isSubmitting}
          {...form.register("mealName")}
        />
        {mealNameSuggestions.length > 0 && (
          <datalist id={datalistId}>
            {mealNameSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        )}
        {form.formState.errors.mealName ? (
          <p className="text-sm text-destructive">{form.formState.errors.mealName.message}</p>
        ) : null}
      </div>

      {/* Effort — pill chips */}
      <div className="grid gap-[5px]">
        <span className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]">
          Effort
        </span>
        <div className="flex flex-wrap gap-1.5">
          {effortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                form.setValue("effortLevel", opt.value, { shouldValidate: true })
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-[5px] rounded-full border px-[11px] py-[6px] text-[12px] transition-all duration-[120ms]",
                selectedEffort === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-[var(--border-strong,#cfccc0)] hover:text-foreground",
                isSubmitting && "pointer-events-none opacity-50"
              )}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-current opacity-60" />
              {opt.label}
            </button>
          ))}
        </div>
        {form.formState.errors.effortLevel ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.effortLevel.message}
          </p>
        ) : null}
      </div>

      {/* Date + Photo row */}
      <div className="grid grid-cols-2 gap-[10px] max-[480px]:grid-cols-1">
        <div className="grid gap-[5px]">
          <label
            htmlFor="cookedDate"
            className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]"
          >
            Cooked on
          </label>
          <Input
            id="cookedDate"
            type="date"
            disabled={isSubmitting}
            {...form.register("cookedDate")}
          />
          {form.formState.errors.cookedDate ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.cookedDate.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-[5px]">
          <Label
            htmlFor="photo"
            className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]"
          >
            Photo
          </Label>
          <label
            htmlFor="photo"
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background transition-colors hover:border-[var(--border-strong,#cfccc0)] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              isSubmitting && "pointer-events-none opacity-50"
            )}
          >
            <Camera className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[13px]">
              {photoFile ? photoFile.name : "Add photo"}
            </span>
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            disabled={isSubmitting}
            className="sr-only"
            onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="grid gap-[5px]">
        <label
          htmlFor="qlNotes"
          className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]"
        >
          Notes{" "}
          <span className="font-normal" style={{ color: "var(--subtle-fg, #8b948e)" }}>
            — optional
          </span>
        </label>
        <Textarea
          id="qlNotes"
          placeholder="What made it worth remembering?"
          disabled={isSubmitting}
          className="min-h-[56px] resize-y"
          {...form.register("notes")}
        />
        {form.formState.errors.notes ? (
          <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
        ) : null}
      </div>

      {/* Recipe — collapsible */}
      <div className="rounded-md border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setIsRecipeOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          aria-expanded={isRecipeOpen}
        >
          <span className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]">
            Recipe{" "}
            <span className="font-normal" style={{ color: "var(--subtle-fg, #8b948e)" }}>
              — optional
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform duration-150",
              isRecipeOpen && "rotate-180"
            )}
          />
        </button>

        {isRecipeOpen && (
          <div className="grid gap-3 border-t border-[var(--border)] px-3 pb-3 pt-3">
            <div className="grid gap-[5px]">
              <label
                htmlFor="recipeText"
                className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]"
              >
                Recipe
              </label>
              <Textarea
                id="recipeText"
                placeholder="Paste or type the recipe here — ingredients, steps, anything useful."
                disabled={isSubmitting}
                className="min-h-[120px] resize-y font-mono text-[12.5px]"
                {...(() => {
                  const { ref, ...rest } = form.register("recipeText");
                  return {
                    ...rest,
                    ref: (el: HTMLTextAreaElement | null) => {
                      ref(el);
                      recipeTextareaRef.current = el;
                    }
                  };
                })()}
              />
              {form.formState.errors.recipeText ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.recipeText.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-[5px]">
              <label
                htmlFor="recipeSourceUrl"
                className="text-[11.5px] font-medium tracking-[0.02em] text-[var(--muted-foreground)]"
              >
                Source URL
              </label>
              <Input
                id="recipeSourceUrl"
                type="url"
                placeholder="https://example.com/recipe"
                disabled={isSubmitting}
                {...form.register("recipeSourceUrl")}
              />
              {form.formState.errors.recipeSourceUrl ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.recipeSourceUrl.message}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {successMessage ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Log meal
      </Button>
    </form>
  );
}
