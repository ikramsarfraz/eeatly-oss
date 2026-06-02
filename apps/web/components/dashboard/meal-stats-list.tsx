import Link from "next/link";
import type { Route } from "next";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { MealThumb } from "@/components/dashboard/meal-thumb";
import type { MealStat } from "@/types";

export function MealStatsList({
  title,
  meals
}: {
  title: string;
  meals: MealStat[];
}) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border bg-[var(--surface)]"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between border-b px-[18px] py-4">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          {title}{" "}
          <span className="rounded-[5px] bg-[var(--surface-2)] px-[7px] py-px font-mono-brand text-[11px] text-muted-foreground">
            {meals.length}
          </span>
        </h3>
        <Link
          href="/library"
          className="text-[11.5px] text-muted-foreground hover:text-foreground"
          aria-label={`View all meals — ${title}`}
        >
          view all
        </Link>
      </div>

      <div>
        {meals.length === 0 ? (
          <div className="px-[18px] py-4 text-sm text-muted-foreground">
            This fills in automatically as you repeat meals.
          </div>
        ) : null}
        {meals.slice(0, 5).map((meal, i) => {
          const daysAgo = meal.lastCookedAt
            ? differenceInCalendarDays(new Date(), parseISO(meal.lastCookedAt))
            : null;
          const isStale = daysAgo !== null && daysAgo >= 14;

          return (
            // R25 — whole row navigates to /meal/[id]. Same pattern as
            // RecentHistoryList: <Link> wrapper + stopPropagation on
            // any interactive children so the action button stays
            // independently tappable. The cook-count badge is purely
            // decorative (no onClick) so it doesn't need a boundary.
            <Link
              key={meal.mealId}
              href={`/meal/${meal.mealId}` as Route}
              className="grid cursor-pointer grid-cols-[44px_1fr_auto] items-center gap-3 border-b px-[18px] py-[11px] last:border-0 hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              aria-label={`Open recipe for ${meal.mealName}`}
            >
              {/* Thumbnail — photo if uploaded, gradient fallback otherwise */}
              <MealThumb
                photoUrl={meal.photoUrl}
                mealName={meal.mealName}
                fallbackIndex={i}
              />

              {/* Info — name in the same visual weight as before. */}
              <div className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-foreground">
                  {meal.mealName}
                </span>
                <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                  <span>
                    {meal.lastCookedAt
                      ? `last ${format(parseISO(meal.lastCookedAt), "MMM d")}`
                      : "never cooked"}
                  </span>
                  {isStale ? (
                    <>
                      <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
                      <span style={{ color: "var(--accent)" }}>{daysAgo}d ago</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Cook count badge (display-only) OR log-again button
                  (interactive). Wrap the interactive case in a
                  stopPropagation boundary so the tap doesn't navigate
                  to /meal/[id]. */}
              {"cookCount" in meal && typeof meal.cookCount === "number" ? (
                <span className="rounded-[6px] bg-[var(--surface-2)] px-[7px] py-[3px] font-mono-brand text-[11.5px] font-medium text-foreground">
                  {meal.cookCount}×
                </span>
              ) : (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                    }
                  }}
                >
                  <LogAgainButton
                    mealName={meal.mealName}
                    variant="default"
                    compact
                    iconOnly
                  />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
