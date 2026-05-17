import { cn } from "@/lib/utils";

/**
 * Round 21 — web port of the mobile step-card structure from
 * `apps/mobile/app/(authed)/meal/[id]/index.tsx` (lines 1036–1115).
 *
 * Shape: italic-serif numeral on the left, right column with serif
 * step title, optional mono time eyebrow, body prose, and a wrapping
 * row of pill-shaped ingredient references resolved to names.
 *
 * The component takes a flattened `step` (numbers and ingredient names
 * already resolved by the caller). The recipe page owns the
 * id→name lookup against `structuredIngredients` — exactly the
 * mobile pattern — so this primitive only has to render.
 */
export type StepCardData = {
  number: number;
  title: string;
  time: string | null;
  body: string;
  /** Ingredient *names*, already resolved from `ingredientIds`. */
  ingredients: string[];
};

export function StepCard({ step }: { step: StepCardData }) {
  const hasBody = step.body.trim().length > 0;
  const hasItems = step.ingredients.length > 0;
  const titleRowGutter = hasBody || hasItems ? "mb-2" : "";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-[18px]">
      <div className={cn("flex items-baseline gap-3", titleRowGutter)}>
        <span
          className="font-serif italic text-[28px] leading-none text-primary sm:text-[32px]"
          style={{ letterSpacing: "-0.02em", minWidth: 28 }}
          aria-hidden
        >
          {step.number}.
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="font-serif text-[20px] leading-[1.05] text-foreground sm:text-[22px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {step.title}
          </p>
          {step.time ? (
            <p
              className="mt-1 font-mono text-[10.5px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.12em" }}
            >
              {step.time}
            </p>
          ) : null}
        </div>
      </div>

      {hasBody ? (
        <p
          className={cn(
            "ml-[40px] text-[14px] leading-[1.5] text-foreground/85",
            hasItems ? "mb-3" : ""
          )}
        >
          {step.body}
        </p>
      ) : null}

      {hasItems ? (
        <ul className="ml-[40px] flex flex-wrap gap-1.5">
          {step.ingredients.map((name, idx) => (
            <li
              key={`${idx}-${name}`}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-[5px] font-mono text-[11.5px] text-foreground/80"
              style={{ letterSpacing: "0.02em" }}
            >
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
