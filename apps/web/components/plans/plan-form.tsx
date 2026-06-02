"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Loader2 } from "lucide-react";
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
} from "@eeatly/api/validators/plans";

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
    formState: { errors, isSubmitting, isValid }
  } = useForm<CreatePlanInput>({
    resolver: zodResolver(createPlanSchema),
    mode: "onChange",
    defaultValues: {
      name: defaultValues?.name ?? "",
      scheduledDate:
        defaultValues?.scheduledDate ?? new Date().toISOString().slice(0, 10),
      notes: defaultValues?.notes ?? ""
    }
  });

  const busy = isSubmitting || create.isPending || update.isPending;
  // Create is disabled until the form is valid (the schema requires a name).
  const canSubmit = isValid;

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
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-[22px]">
      <div className="grid gap-2">
        <Label htmlFor="plan-name">Name</Label>
        <Input
          id="plan-name"
          {...register("name")}
          placeholder="Eid al-Adha 2026"
          autoComplete="off"
          autoFocus
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="plan-date">Date</Label>
        <Input id="plan-date" type="date" {...register("scheduledDate")} />
        {errors.scheduledDate ? (
          <p className="text-xs text-destructive">{errors.scheduledDate.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="plan-notes">Notes</Label>
          <span
            className="font-mono text-[10px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.1em" }}
          >
            Optional
          </span>
        </div>
        <Textarea
          id="plan-notes"
          rows={4}
          className="min-h-[104px]"
          {...register("notes")}
          placeholder="Table for 14, guests bringing dessert…"
        />
      </div>

      <div className="flex justify-end gap-2.5 border-t border-[var(--border-soft,var(--border))] pt-5">
        {onCancel || mode === "create" ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel ?? (() => router.push("/plans" as never))}
            disabled={busy}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy || (mode === "create" && !canSubmit)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Create plan" : "Save"}
          {mode === "create" && !busy ? <ChevronRight className="h-4 w-4" /> : null}
        </Button>
      </div>
    </form>
  );
}
