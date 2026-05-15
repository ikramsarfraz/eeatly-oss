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
import { trpc } from "@/lib/trpc/client";
import { isUpgradeRequired } from "@/lib/trpc/errors";
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
  const create = trpc.plans.create.useMutation();
  const update = trpc.plans.update.useMutation();
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
      try {
        const result = await create.mutateAsync(values);
        showToast({ variant: "success", title: "Plan created" });
        router.push(`/plans/${result.planId}` as never);
      } catch (error) {
        // Upgrade prompt was previously surfaced via the plans-page
        // dialog; the form-level toast keeps copy here consistent
        // with the Round 6 messaging.
        showToast({
          variant: "error",
          title: isUpgradeRequired(error)
            ? "Upgrade required"
            : "Couldn't create plan",
          description: error instanceof Error ? error.message : undefined
        });
      }
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
    try {
      await update.mutateAsync({ planId, patch: values });
      showToast({ variant: "success", title: "Saved" });
      onSaved?.();
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't save",
        description: error instanceof Error ? error.message : undefined
      });
    }
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
            disabled={isSubmitting || create.isPending || update.isPending}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={isSubmitting || create.isPending || update.isPending}
        >
          {isSubmitting || create.isPending || update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {mode === "create" ? "Create plan" : "Save"}
        </Button>
      </div>
    </form>
  );
}
