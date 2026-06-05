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
 *
 * Round 27 — visual retune for the editorial Recipe Detail. Same
 * data shape, same props; the card chrome (border + bg + rounded-xl
 * surface) is replaced by an open grid layout that lets steps stack
 * with a hairline separator between them. The numeral grows to 56px
 * italic display serif (forest) and the title bumps to 28px display
 * serif. Body text gains a max-width so long paragraphs read at
 * comfortable measure. Ingredient pills move to a cream-tinted lozenge
 * treatment that contrasts more cleanly against the new
 * `bg-background` page surface.
 *
 * Existing tests (`step-card.test.tsx`) query by text content — they
 * pass unchanged because the numerals, title, time eyebrow, body text,
 * and ingredient names are all still rendered as the same strings.
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
  // Parsed/auto-structured steps are single instructions with no separate
  // title — render just the number + body so they read as a clean numbered
  // list instead of a big empty heading.
  const hasTitle = step.title.trim().length > 0;

  return (
    <article
      className="grid grid-cols-[56px_1fr] gap-[18px] py-[18px] sm:grid-cols-[64px_1fr] sm:gap-[22px]"
      data-step-card
    >
      <span
        // The numeral is editorial decoration — accent of the page.
        // Forest (primary) color stays consistent across light + dark.
        // 56px on mobile, 60-64px on desktop tracks the design's display
        // scale. Period is part of the visual rhythm; no separate
        // element so screen readers don't double-read.
        className="font-serif italic leading-none text-primary text-[48px] sm:text-[56px] lg:text-[60px]"
        style={{ letterSpacing: "-0.02em" }}
        aria-hidden
      >
        {step.number}.
      </span>
      <div className="min-w-0">
        {hasTitle ? (
          <p
            className="font-serif text-[24px] leading-[1.05] text-foreground sm:text-[28px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {step.title}
          </p>
        ) : null}
        {step.time ? (
          <p
            className="mt-2 font-mono text-[10.5px] uppercase text-muted-foreground"
            style={{ letterSpacing: "0.14em" }}
          >
            {step.time}
          </p>
        ) : null}
        {hasBody ? (
          <p
            className={cn(
              "mt-3 max-w-[620px] text-[14px] leading-[1.55] text-foreground/85",
              hasItems ? "mb-3" : ""
            )}
          >
            {step.body}
          </p>
        ) : null}
        {hasItems ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {step.ingredients.map((name, idx) => (
              <li
                key={`${idx}-${name}`}
                // Cream-tinted lozenge — picks up the warm ground of
                // the new page surface without competing with the
                // step body's reading rhythm.
                className="rounded-full border border-[var(--border-soft,var(--border))] bg-[var(--surface-2)] px-2.5 py-[5px] text-[12px] font-medium text-foreground/80"
                style={{ letterSpacing: "-0.01em" }}
              >
                {name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
