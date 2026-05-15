"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { COOK_FREQUENCY_BUCKETS } from "@eeatly/api/validators/onboarding";
import { cn } from "@/lib/utils";
import type { EffortLevel } from "@/types";

const EFFORT_OPTIONS: { value: EffortLevel; label: string; helper: string }[] = [
  { value: "quick", label: "Quick", helper: "Under 15 min" },
  { value: "easy", label: "Easy", helper: "15–30 min" },
  { value: "medium", label: "Medium", helper: "30–60 min" },
  { value: "high_effort", label: "Project", helper: "An hour or more" }
];

type Props = {
  cooksPerWeek: number | null;
  weeknightEffort: EffortLevel | null;
};

export function PreferencesCard({ cooksPerWeek, weeknightEffort }: Props) {
  const { showToast } = useToast();
  const [draftCooks, setDraftCooks] = React.useState<number | null>(cooksPerWeek);
  const [draftEffort, setDraftEffort] = React.useState<EffortLevel | null>(weeknightEffort);
  const updateMutation = trpc.onboarding.updatePreferences.useMutation();
  const pending = updateMutation.isPending;

  const dirty = draftCooks !== cooksPerWeek || draftEffort !== weeknightEffort;
  const valid = draftCooks !== null && draftEffort !== null;

  async function handleSave() {
    if (!valid || !dirty) return;
    try {
      await updateMutation.mutateAsync({
        cooksPerWeek: draftCooks!,
        weeknightEffort: draftEffort!
      });
      showToast({ variant: "success", title: "Preferences saved" });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't save preferences",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cooking preferences</CardTitle>
        <CardDescription>
          Captured during onboarding. We use these to tune what eeatly surfaces.
          Change them anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <fieldset className="grid gap-3">
          <legend className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            How often do you cook?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {COOK_FREQUENCY_BUCKETS.map((bucket) => {
              const active = draftCooks === bucket.value;
              return (
                <button
                  key={bucket.value}
                  type="button"
                  onClick={() => setDraftCooks(bucket.value)}
                  aria-pressed={active}
                  className={cn(
                    "grid gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-[var(--primary-soft)] text-foreground"
                      : "border-border bg-[var(--surface)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <span className="text-[13px] font-medium">{bucket.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{bucket.helper}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Your weeknight default
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {EFFORT_OPTIONS.map((opt) => {
              const active = draftEffort === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraftEffort(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    "grid gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-[var(--primary-soft)] text-foreground"
                      : "border-border bg-[var(--surface)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <span className="text-[13px] font-medium">{opt.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{opt.helper}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!valid || !dirty || pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
