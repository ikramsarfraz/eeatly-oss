import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type EffortAggregate = {
  quick: number;
  easy: number;
  medium: number;
  high_effort: number;
  unrated: number;
};

/**
 * Small effort breakdown chip for the plan-detail header. Surfaces
 * "is this plan too ambitious" without shouting. Uses actual annotated
 * effort where set, falls back to the most-recent meal-log effort per
 * meal (computed server-side in services/plans:getPlanEffortAggregate).
 *
 * Empty plans render nothing. Plans with only `unrated` dishes show a
 * small "no effort data yet" hint so the chip stays informational rather
 * than disappearing.
 */
export function EffortAggregateChip({ aggregate }: { aggregate: EffortAggregate }) {
  const total =
    aggregate.quick +
    aggregate.easy +
    aggregate.medium +
    aggregate.high_effort +
    aggregate.unrated;
  if (total === 0) return null;

  const segments: Array<{ label: string; count: number; tone?: "warn" }> = [];
  if (aggregate.quick > 0) segments.push({ label: "quick", count: aggregate.quick });
  if (aggregate.easy > 0) segments.push({ label: "easy", count: aggregate.easy });
  if (aggregate.medium > 0) segments.push({ label: "medium", count: aggregate.medium });
  if (aggregate.high_effort > 0)
    segments.push({ label: "high", count: aggregate.high_effort, tone: "warn" });
  if (aggregate.unrated > 0) segments.push({ label: "unrated", count: aggregate.unrated });

  // Heuristic for the subtle "ambitious" cue: more than 2 high-effort
  // dishes on one plan tends to be the day Tina ends up tired. Loud
  // would be wrong here; we just nudge the chip color.
  const ambitious = aggregate.high_effort >= 3;

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-[11px]",
        ambitious
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          : "text-muted-foreground"
      )}
      role="status"
      aria-label={ambitious ? "Plan looks ambitious" : "Effort breakdown"}
    >
      {ambitious ? <Flame className="h-3 w-3" aria-hidden /> : null}
      {segments.map((s, i) => (
        <span key={s.label}>
          {s.count} {s.label}
          {i < segments.length - 1 ? " · " : ""}
        </span>
      ))}
    </div>
  );
}
