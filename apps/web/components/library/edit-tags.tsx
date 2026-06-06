"use client";

import * as React from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/providers/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { MobileSheet } from "@/components/mobile/mobile-sheet";
import {
  CUISINE_OPTIONS,
  COURSE_OPTIONS,
  MAIN_OPTIONS,
  DIET_OPTIONS,
  OCCASION_OPTIONS,
  type MealTags
} from "@/lib/meals/tags";

type EditTagsTarget = { id: string; name: string; tags: MealTags };

/** Merge the guidance vocab with whatever the recipe already carries so a
 *  non-standard existing value still shows as a (selected) chip. */
function withCurrent(options: string[], ...current: (string | null)[]): string[] {
  const out = [...options];
  for (const c of current) if (c && !out.includes(c)) out.push(c);
  return out;
}

function useEditTags(target: EditTagsTarget, onClose: () => void) {
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [tags, setTags] = React.useState<MealTags>(target.tags);

  const save = trpc.meals.updateTags.useMutation({
    onSuccess: () => {
      void utils.invalidate();
      showToast({ variant: "success", title: "Tags updated" });
      onClose();
    },
    onError: () => showToast({ variant: "error", title: "Could not save tags." })
  });
  const regenerate = trpc.meals.generateTags.useMutation({
    onSuccess: (next) => {
      if (next) setTags(next);
      showToast({ variant: "success", title: "Re-tagged by eeatly" });
    },
    onError: () => showToast({ variant: "error", title: "Could not re-tag." })
  });

  const setSingle = (key: "cuisine" | "course" | "mainIngredient", value: string) =>
    setTags((t) => ({ ...t, [key]: t[key] === value ? null : value }));
  const toggleMulti = (key: "diet" | "occasion", value: string) =>
    setTags((t) => ({
      ...t,
      [key]: t[key].includes(value) ? t[key].filter((v) => v !== value) : [...t[key], value]
    }));

  return { tags, setSingle, toggleMulti, save, regenerate };
}

function Chip({
  label,
  active,
  removable,
  onClick
}: {
  label: string;
  active: boolean;
  removable?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
        active
          ? "border-primary bg-[color:var(--sage-soft)] text-primary"
          : "border-border bg-transparent text-foreground hover:bg-[color:var(--surface-2)]"
      )}
    >
      {label}
      {active && removable ? <X className="h-3 w-3 opacity-70" /> : null}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function EditTagsBody({
  target,
  onClose
}: {
  target: EditTagsTarget;
  onClose: () => void;
}) {
  const { tags, setSingle, toggleMulti, save, regenerate } = useEditTags(target, onClose);

  // Occasion suggestions = vocab not already applied (the "accept a suggestion" loop).
  const occasionSuggestions = OCCASION_OPTIONS.filter((o) => !tags.occasion.includes(o));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Auto-tagged by eeatly
      </div>

      <Group label="Cuisine">
        {withCurrent(CUISINE_OPTIONS, tags.cuisine).map((v) => (
          <Chip key={v} label={v} active={tags.cuisine === v} removable onClick={() => setSingle("cuisine", v)} />
        ))}
      </Group>
      <Group label="Course">
        {withCurrent(COURSE_OPTIONS, tags.course).map((v) => (
          <Chip key={v} label={v} active={tags.course === v} removable onClick={() => setSingle("course", v)} />
        ))}
      </Group>
      <Group label="Main ingredient">
        {withCurrent(MAIN_OPTIONS, tags.mainIngredient).map((v) => (
          <Chip key={v} label={v} active={tags.mainIngredient === v} removable onClick={() => setSingle("mainIngredient", v)} />
        ))}
      </Group>
      <Group label="Diet">
        {withCurrent(DIET_OPTIONS, ...tags.diet).map((v) => (
          <Chip key={v} label={v} active={tags.diet.includes(v)} removable onClick={() => toggleMulti("diet", v)} />
        ))}
      </Group>
      <Group label="Occasion">
        {tags.occasion.map((v) => (
          <Chip key={v} label={v} active removable onClick={() => toggleMulti("occasion", v)} />
        ))}
        {tags.occasion.length === 0 ? null : null}
      </Group>

      {occasionSuggestions.length > 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-[color:var(--surface-2)] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Suggested by eeatly
          </div>
          <div className="flex flex-wrap gap-1.5">
            {occasionSuggestions.map((v) => (
              <Chip key={v} label={`+ ${v}`} active={false} onClick={() => toggleMulti("occasion", v)} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => regenerate.mutate({ mealId: target.id, force: true })}
          disabled={regenerate.isPending}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary disabled:opacity-50"
        >
          {regenerate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Re-tag with AI
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] border border-border bg-card px-4 text-[13.5px] font-semibold text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate({ mealId: target.id, tags })}
            disabled={save.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save tags
          </button>
        </div>
      </div>
    </div>
  );
}

/** Desktop modal. */
export function EditTagsDialog({
  target,
  onClose
}: {
  target: EditTagsTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="truncate">{target?.name}</DialogTitle>
        </DialogHeader>
        {target ? <EditTagsBody target={target} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Mobile bottom sheet. */
export function EditTagsSheet({
  target,
  onClose
}: {
  target: EditTagsTarget | null;
  onClose: () => void;
}) {
  return (
    <MobileSheet open={target !== null} label={target?.name} onClose={onClose}>
      {target ? <EditTagsBody target={target} onClose={onClose} /> : null}
    </MobileSheet>
  );
}

export type { EditTagsTarget };
