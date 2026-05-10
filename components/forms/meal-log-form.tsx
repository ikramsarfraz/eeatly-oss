"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMealLog } from "@/hooks/use-dashboard-meals";
import { endpoints, type PresignUploadResponse } from "@/lib/api/endpoints";
import { mealLogInputSchema, type MealLogInput } from "@/lib/validators/meals";

type MealLogFormProps = {
  canWrite: boolean;
  onSuccess?: () => void;
};

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
    setSuccessMessage("Meal logged. Your dashboard is refreshed.");
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
      className="grid gap-4"
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
          Meal logging is unavailable for this session.
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="mealName">Meal name</Label>
        <Input
          id="mealName"
          placeholder="Lemon herb chicken bowls"
          disabled={!canWrite || isSubmitting}
          {...form.register("mealName")}
        />
        {form.formState.errors.mealName ? (
          <p className="text-sm text-destructive">{form.formState.errors.mealName.message}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Use the name you would search for later, like “soy ginger noodles”.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="effortLevel">Effort</Label>
          <Select
            value={form.watch("effortLevel")}
            onValueChange={(value) =>
              form.setValue("effortLevel", value as MealLogInput["effortLevel"], {
                shouldValidate: true
              })
            }
            disabled={!canWrite || isSubmitting}
          >
            <SelectTrigger id="effortLevel">
              <SelectValue placeholder="Choose effort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick">Quick</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high_effort">High effort</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.effortLevel ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.effortLevel.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cookedDate">Cooked date</Label>
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
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="What made it worth remembering?"
          disabled={!canWrite || isSubmitting}
          {...form.register("notes")}
        />
        {form.formState.errors.notes ? (
          <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="photo">
          <span className="inline-flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Optional photo
          </span>
        </Label>
        <Input
          id="photo"
          type="file"
          accept="image/*"
          disabled={!canWrite || isSubmitting}
          onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
        />
        {photoFile ? (
          <p className="text-sm text-muted-foreground">{photoFile.name}</p>
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

      <Button type="submit" disabled={!canWrite || isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Log meal
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Shortcut: ⌘ Enter or Ctrl+Enter from any focused field submits this form.
      </p>
    </form>
  );
}
