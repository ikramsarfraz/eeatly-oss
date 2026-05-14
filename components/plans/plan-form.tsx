"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { createPlanAction, updatePlanAction } from "@/actions/plans";
import {
  createPlanSchema,
  type CreatePlanInput
} from "@/lib/validators/plans";

type PlanFormProps = {
  mode: "create" | "edit";
  planId?: string;
  defaultValues?: Partial<CreatePlanInput>;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function PlanForm({
  mode,
  planId,
  defaultValues,
  onSaved,
  onCancel
}: PlanFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<CreatePlanInput>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      scheduledDate:
        defaultValues?.scheduledDate ?? new Date().toISOString().slice(0, 10),
      notes: defaultValues?.notes ?? ""
    }
  });

  async function onSubmit(values: CreatePlanInput) {
    if (mode === "create") {
      const result = await createPlanAction(values);
      if (result.ok) {
        showToast({ variant: "success", title: "Plan created" });
        router.push(`/plans/${result.planId}` as never);
        return;
      }
      showToast({
        variant: "error",
        title: "Couldn't create plan",
        description: result.message
      });
      return;
    }

    if (!planId) {
      showToast({
        variant: "error",
        title: "Missing plan id",
        description: "Refresh and try again."
      });
      return;
    }
    const result = await updatePlanAction(planId, values);
    if (result.ok) {
      showToast({ variant: "success", title: "Saved" });
      onSaved?.();
      router.refresh();
      return;
    }
    showToast({
      variant: "error",
      title: "Couldn't save",
      description: result.message
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="plan-name">Name</Label>
        <Input
          id="plan-name"
          {...register("name")}
          placeholder="Eid al-Adha 2025"
          autoComplete="off"
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="plan-date">Date</Label>
        <Input
          id="plan-date"
          type="date"
          {...register("scheduledDate")}
        />
        {errors.scheduledDate ? (
          <p className="text-xs text-destructive">{errors.scheduledDate.message}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="plan-notes">Notes (optional)</Label>
        <Textarea
          id="plan-notes"
          rows={3}
          {...register("notes")}
          placeholder="Table for 14, guests bringing dessert"
        />
      </div>

      <div className="flex gap-2 sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Create plan" : "Save"}
        </Button>
      </div>
    </form>
  );
}
