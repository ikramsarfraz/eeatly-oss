"use client";

import "../../app/assist.css";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { useToast } from "@/components/providers/toast-provider";
import { blobToBase64 } from "@/lib/refine/use-voice-recorder";
import { SUPPORTED_AUDIO_MEDIA_TYPES } from "@eeatly/api/validators/ai";
import { cn } from "@/lib/utils";
import type { EffortLevel } from "@/types";

import { AssistBar } from "./assist-bar";
import { EffortPills } from "./effort-pills";
import { AeButton, AeInput, AeDivider, Lbl } from "./field-atoms";
import { Drag, Trash, Plus, Check, Sparkle } from "./assist-icons";

type ImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
type Row = { key: string; text: string; flagged: boolean };

const EFFORT_LABEL: Record<EffortLevel, string> = {
  quick: "Quick",
  easy: "Easy",
  medium: "Medium",
  high_effort: "High"
};

let rowSeq = 0;
const nextKey = () => `row-${rowSeq++}`;
const toRows = (items: string[]): Row[] =>
  items.map((text) => ({ key: nextKey(), text, flagged: false }));

/**
 * Edit recipe — "Assist" redesign. Manual rows are always the surface; the AI
 * Assist Bar applies a change ("double the beef") straight into the rows (via
 * the stateless `refine.preview*` procedures), flagging what it touched. Save
 * persists the structured recipe. Replaces the manual editor + the separate
 * Refine session/diff-review flow.
 */
export function EditAssistClient({
  mealId,
  mealName,
  effort,
  servings: initialServings,
  ingredients: initialIngredients,
  steps: initialSteps
}: {
  mealId: string;
  mealName: string;
  effort: EffortLevel | null;
  servings: string;
  ingredients: string[];
  steps: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = React.useState(mealName);
  const [effortLevel, setEffortLevel] = React.useState<EffortLevel>(effort ?? "medium");
  const [servings, setServings] = React.useState(initialServings);
  const [ingredients, setIngredients] = React.useState<Row[]>(() => toRows(initialIngredients));
  const [steps, setSteps] = React.useState<Row[]>(() => toRows(initialSteps));

  const previewText = trpc.refine.previewText.useMutation();
  const previewVoice = trpc.refine.previewVoice.useMutation();
  const previewPhoto = trpc.refine.previewPhoto.useMutation();
  const saveMutation = trpc.meals.saveStructuredRecipe.useMutation();
  const [saving, setSaving] = React.useState(false);

  const metaLine = [
    EFFORT_LABEL[effortLevel].toUpperCase(),
    servings.trim()
      ? (/serv|make/i.test(servings) ? servings : `Serves ${servings}`).toUpperCase()
      : null,
    `${ingredients.length} ${ingredients.length === 1 ? "INGREDIENT" : "INGREDIENTS"}`,
    `${steps.length} ${steps.length === 1 ? "STEP" : "STEPS"}`
  ]
    .filter(Boolean)
    .join(" · ");

  function pour(p: {
    ingredients: Array<{ id: string; text: string; changed: boolean }>;
    steps: Array<{ id: string; text: string; changed: boolean }>;
    servings: string | null;
  }) {
    setIngredients(p.ingredients.map((r) => ({ key: r.id, text: r.text, flagged: r.changed })));
    setSteps(p.steps.map((r) => ({ key: r.id, text: r.text, flagged: r.changed })));
    if (p.servings != null) setServings(p.servings);
    void utils.credits.balance.invalidate();
  }

  function onAiError(err: unknown) {
    const reason = getCause(err)?.reason;
    showToast({
      variant: "error",
      title:
        reason === "RATE_LIMITED"
          ? "AI limit reached"
          : reason === "UPGRADE_REQUIRED"
            ? "Upgrade required"
            : "Couldn't apply that",
      description:
        reason === "RATE_LIMITED"
          ? "Try again tomorrow."
          : err instanceof Error
            ? err.message
            : "Please try again."
    });
  }

  const runText = async (prompt: string) => {
    try {
      pour(await previewText.mutateAsync({ mealId, prompt }));
    } catch (err) {
      onAiError(err);
      throw err;
    }
  };
  const runVoice = async (audio: Blob, fileName: string) => {
    try {
      const audioBase64 = await blobToBase64(audio);
      pour(
        await previewVoice.mutateAsync({
          mealId,
          audioBase64,
          mediaType: audio.type as (typeof SUPPORTED_AUDIO_MEDIA_TYPES)[number],
          fileName
        })
      );
    } catch (err) {
      onAiError(err);
      throw err;
    }
  };
  const runPhoto = async (file: File) => {
    try {
      const imageBase64 = await blobToBase64(file);
      pour(await previewPhoto.mutateAsync({ mealId, imageBase64, mediaType: file.type as ImageMime }));
    } catch (err) {
      onAiError(err);
      throw err;
    }
  };

  async function save() {
    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        mealId,
        servings: servings.trim(),
        ingredients: ingredients
          .filter((r) => r.text.trim().length > 0)
          .map((r) => ({ name: r.text.trim() })),
        steps: steps
          .filter((r) => r.text.trim().length > 0)
          .map((r) => ({ title: r.text.trim() }))
      });
      await utils.meals.getById.invalidate({ mealId });
      showToast({ variant: "success", title: "Changes saved" });
      router.push(`/meal/${mealId}` as Route);
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

  const letter = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="ae-scope mx-auto w-full max-w-[720px] pb-24 sm:pb-2">
      {/* Identity */}
      <div className="mb-5 flex items-center gap-[13px]">
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] bg-[color:var(--ae-rose-bg)] font-[family-name:var(--ae-display)] text-[26px] italic text-[color:var(--ae-rose-fg)]">
          {letter}
        </div>
        <div className="min-w-0">
          <div className="truncate font-[family-name:var(--ae-display)] text-[26px] leading-none tracking-[-0.02em] text-[color:var(--ae-ink)]">
            {name}
          </div>
          <div className="mt-[5px] font-[family-name:var(--ae-mono)] text-[10px] uppercase tracking-[0.08em] text-[color:var(--ae-ink3)]">
            {metaLine}
          </div>
        </div>
      </div>

      <AssistBar
        variant="edit"
        title="Change a lot at once, by talking or typing"
        sub="“Double the beef, make it spicier, add prep times.”"
        cta="Ask AI"
        runPhoto={runPhoto}
        runText={runText}
        runVoice={runVoice}
      />

      <AeDivider label="or edit by hand" />

      <div className="flex flex-col gap-5 rounded-[18px] border border-[color:var(--ae-border)] bg-[color:var(--ae-surface)] p-[26px] shadow-[var(--ae-card-shadow)]">
        <div>
          <Lbl>Recipe name</Lbl>
          <AeInput value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Lbl>Effort</Lbl>
            <EffortPills value={effortLevel} onChange={setEffortLevel} />
          </div>
          <div>
            <Lbl>Serves</Lbl>
            <AeInput value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
          </div>
        </div>

        <RowList title="Ingredients" rows={ingredients} onChange={setIngredients} addLabel="Add ingredient" />
        <RowList title="Steps" rows={steps} onChange={setSteps} addLabel="Add step" />
      </div>

      {/* Web action row */}
      <div className="mt-[22px] hidden items-center justify-end gap-[10px] border-t border-[color:var(--ae-border-soft)] pt-[18px] sm:flex">
        <AeButton variant="ghost" onClick={() => router.back()}>
          Cancel
        </AeButton>
        <AeButton onClick={save} disabled={saving}>
          <Check size={16} /> {saving ? "Saving…" : "Save changes"}
        </AeButton>
      </div>

      {/* Mobile sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-[color:var(--ae-border)] bg-[color:var(--ae-cream)] p-3 sm:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-12 shrink-0 rounded-[12px] border border-[color:var(--ae-border)] px-4 text-[14px] font-semibold text-[color:var(--ae-ink2)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[color:var(--ae-forest)] text-[15px] font-semibold text-[color:var(--ae-forest-text)] shadow-[var(--ae-cta-shadow)] disabled:opacity-60"
        >
          <Check size={17} /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/** Editable, reorderable single-line rows (ingredients / steps). */
function RowList({
  title,
  rows,
  onChange,
  addLabel
}: {
  title: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  addLabel: string;
}) {
  const dragIndex = React.useRef<number | null>(null);

  function update(i: number, text: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, text } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...rows, { key: nextKey(), text: "", flagged: false }]);
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = rows.slice();
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div>
      <Lbl>{title}</Lbl>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={row.key}
            draggable
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current !== null) reorder(dragIndex.current, i);
              dragIndex.current = null;
            }}
            className={cn(
              "flex h-[42px] items-center gap-2 rounded-[10px] border pl-2 pr-[10px]",
              row.flagged
                ? "bg-[color:var(--ae-flag-bg)] border-[color:var(--ae-flag-border)]"
                : "bg-[color:var(--ae-surface)] border-[color:var(--ae-border)]"
            )}
          >
            <span className="flex shrink-0 cursor-grab text-[color:var(--ae-ink4)]" aria-hidden>
              <Drag size={16} />
            </span>
            <input
              value={row.text}
              onChange={(e) => update(i, e.target.value)}
              className="min-w-0 flex-1 border-none bg-transparent font-[family-name:var(--ae-body)] text-[14px] text-[color:var(--ae-ink)] outline-none"
            />
            {row.flagged && (
              <span className="inline-flex shrink-0 items-center gap-1 font-[family-name:var(--ae-mono)] text-[9px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ae-flag-fg)]">
                <Sparkle size={11} /> AI
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              className="flex shrink-0 text-[color:var(--ae-ink3)] hover:text-[color:var(--ae-danger)]"
            >
              <Trash size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex shrink-0 items-center gap-[7px] self-start whitespace-nowrap rounded-[10px] border border-dashed border-[color:var(--ae-border)] px-[13px] py-2 font-[family-name:var(--ae-body)] text-[13px] font-semibold text-[color:var(--ae-ink2)] hover:text-[color:var(--ae-ink)]"
        >
          <Plus size={15} /> {addLabel}
        </button>
      </div>
    </div>
  );
}
