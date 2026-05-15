"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import type { UpdateDishAnnotationInput } from "@eeatly/api/validators/plans";

export type Annotation = {
  actualEffort: "quick" | "easy" | "medium" | "high_effort" | null;
  timeTakenMinutes: number | null;
  verdict: "repeat" | "modify" | "do_not_repeat" | null;
  annotationNotes: string | null;
};

type AnnotationEditorProps = {
  planDishId: string;
  initial: Annotation;
};

const EFFORTS: Array<{ value: NonNullable<Annotation["actualEffort"]>; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High" }
];

const VERDICTS: Array<{
  value: NonNullable<Annotation["verdict"]>;
  label: string;
  emoji: string;
}> = [
  { value: "repeat", label: "Repeat", emoji: "👍" },
  { value: "modify", label: "Modify", emoji: "✏️" },
  { value: "do_not_repeat", label: "Don't repeat", emoji: "🚫" }
];

/**
 * Inline annotation editor. Collapsed by default, expands to a small form
 * inside the dish row. Saves on change for toggles, on blur for notes /
 * time — partial-update friendly so each control's save is independent.
 *
 * Server is authoritative: every save round-trips through the action and
 * calls router.refresh() so the dish row's summary line (rendered above
 * in PlanDetail) stays in sync.
 */
export function AnnotationEditor({ planDishId, initial }: AnnotationEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [expanded, setExpanded] = React.useState(false);
  const [pendingField, setPendingField] = React.useState<string | null>(null);
  const updateAnnotation = trpc.plans.updateDishAnnotation.useMutation();

  // Local mirror of the annotation so toggles read snappily before the
  // server confirms. We do NOT set this from a useEffect (lint rule); the
  // server-truthy value comes back via router.refresh() and the parent's
  // re-render passes a fresh `initial` next time the editor mounts.
  const [actualEffort, setActualEffort] = React.useState(initial.actualEffort);
  const [timeTakenMinutes, setTimeTakenMinutes] = React.useState(initial.timeTakenMinutes);
  const [verdict, setVerdict] = React.useState(initial.verdict);
  const [annotationNotes, setAnnotationNotes] = React.useState(initial.annotationNotes ?? "");

  async function save(field: string, patch: UpdateDishAnnotationInput) {
    setPendingField(field);
    try {
      await updateAnnotation.mutateAsync({ planDishId, patch });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't save",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setPendingField(null);
    }
  }

  function onEffortClick(value: NonNullable<Annotation["actualEffort"]>) {
    const next = actualEffort === value ? null : value;
    setActualEffort(next);
    void save("effort", { actualEffort: next });
  }

  function onVerdictClick(value: NonNullable<Annotation["verdict"]>) {
    const next = verdict === value ? null : value;
    setVerdict(next);
    void save("verdict", { verdict: next });
  }

  function onTimeBlur() {
    if (timeTakenMinutes === initial.timeTakenMinutes) return;
    if (timeTakenMinutes !== null && (timeTakenMinutes < 0 || timeTakenMinutes > 60 * 24)) {
      showToast({
        variant: "error",
        title: "Time taken is out of range",
        description: "Use a value between 0 and 1440 minutes."
      });
      setTimeTakenMinutes(initial.timeTakenMinutes);
      return;
    }
    void save("time", { timeTakenMinutes });
  }

  function onNotesBlur() {
    const trimmed = annotationNotes.trim();
    const initialTrimmed = initial.annotationNotes?.trim() ?? "";
    if (trimmed === initialTrimmed) return;
    void save("notes", { annotationNotes: trimmed.length > 0 ? trimmed : null });
  }

  const hasAnything =
    actualEffort !== null ||
    timeTakenMinutes !== null ||
    verdict !== null ||
    (annotationNotes ?? "").trim().length > 0;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex w-fit items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Hide notes" : hasAnything ? "Edit notes" : "Add notes"}
      </button>

      {expanded ? (
        <div className="grid gap-3 rounded-md border bg-background/60 p-3">
          <div className="grid gap-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Actual effort
            </Label>
            <div className="flex flex-wrap gap-1">
              {EFFORTS.map((e) => (
                <Button
                  key={e.value}
                  type="button"
                  size="sm"
                  variant={actualEffort === e.value ? "default" : "outline"}
                  className={cn(
                    "h-7 px-2.5 text-[11px]",
                    actualEffort !== e.value && "text-muted-foreground"
                  )}
                  disabled={pendingField === "effort"}
                  onClick={() => onEffortClick(e.value)}
                >
                  {e.label}
                </Button>
              ))}
              {pendingField === "effort" ? (
                <Loader2 className="my-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`time-${planDishId}`}
              className="text-[11px] uppercase tracking-wide text-muted-foreground"
            >
              Time taken
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`time-${planDishId}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={60 * 24}
                value={timeTakenMinutes ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setTimeTakenMinutes(v === "" ? null : Number(v));
                }}
                onBlur={onTimeBlur}
                placeholder="0"
                className="h-8 w-24 text-sm"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
              {pendingField === "time" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Verdict
            </Label>
            <div className="flex flex-wrap gap-1">
              {VERDICTS.map((v) => (
                <Button
                  key={v.value}
                  type="button"
                  size="sm"
                  variant={verdict === v.value ? "default" : "outline"}
                  className={cn(
                    "h-7 px-2.5 text-[11px]",
                    verdict !== v.value && "text-muted-foreground"
                  )}
                  disabled={pendingField === "verdict"}
                  onClick={() => onVerdictClick(v.value)}
                >
                  <span aria-hidden>{v.emoji}</span> {v.label}
                </Button>
              ))}
              {pendingField === "verdict" ? (
                <Loader2 className="my-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`notes-${planDishId}`}
              className="text-[11px] uppercase tracking-wide text-muted-foreground"
            >
              Notes
            </Label>
            <Textarea
              id={`notes-${planDishId}`}
              rows={2}
              value={annotationNotes}
              onChange={(e) => setAnnotationNotes(e.target.value)}
              onBlur={onNotesBlur}
              placeholder="What worked, what to change next time…"
              className="text-sm"
            />
            {pendingField === "notes" ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
