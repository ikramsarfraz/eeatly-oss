"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMealLog } from "@/hooks/use-dashboard-meals";
import { endpoints, type PresignUploadResponse } from "@/lib/api/endpoints";
import { mealLogInputSchema, type MealLogInput } from "@/lib/validators/meals";
import { cn } from "@/lib/utils";

type MealLogFormProps = {
  canWrite: boolean;
  onSuccess?: () => void;
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

  const upload = (await presignResponse.json()) as PresignUploadResponse;
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type
    }
  });

  if (!uploadResponse.ok) {
    throw new Error("Unable to upload photo.");
  }

  return upload.publicUrl;
}

export function MealLogForm({ canWrite, onSuccess }: MealLogFormProps) {
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const form = useForm<MealLogInput>({
    resolver: zodResolver(mealLogInputSchema),
    defaultValues: {
      mealName: "",
      effortLevel: "easy",
      notes: "",
      cookedDate: new Date().toISOString().slice(0, 10),
      photoUrl: ""
    }
  });

  const mutation = useCreateMealLog();
  const isSubmitting = form.formState.isSubmitting || mutation.isPending;
  const selectedEffort = form.watch("effortLevel");

  function resetAfterSuccess() {
    form.reset({
      mealName: "",
      effortLevel: "easy",
      notes: "",
      cookedDate: new Date().toISOString().slice(0, 10),
      photoUrl: ""
    });
    setPhotoFile(null);
    setFormError(null);
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
      {!canWrite ? (
        <div className="rounded-lg border bg-muted/60 p-3 text-sm text-muted-foreground">
          Meal logging isn&apos;t available right now.
        </div>
      ) : null}

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
          disabled={!canWrite || isSubmitting}
          {...form.register("mealName")}
        />
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
              disabled={!canWrite || isSubmitting}
              onClick={() =>
                form.setValue("effortLevel", opt.value, { shouldValidate: true })
              }
              className={cn(
                "inline-flex cursor-pointer items-center gap-[5px] rounded-full border px-[11px] py-[6px] text-[12px] transition-all duration-[120ms]",
                selectedEffort === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-[var(--border-strong,#cfccc0)] hover:text-foreground",
                (!canWrite || isSubmitting) && "pointer-events-none opacity-50"
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
            disabled={!canWrite || isSubmitting}
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
              (!canWrite || isSubmitting) && "pointer-events-none opacity-50"
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
            disabled={!canWrite || isSubmitting}
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
          disabled={!canWrite || isSubmitting}
          className="min-h-[56px] resize-y"
          {...form.register("notes")}
        />
        {form.formState.errors.notes ? (
          <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
        ) : null}
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

      <Button type="submit" disabled={!canWrite || isSubmitting} className="mt-1">
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
