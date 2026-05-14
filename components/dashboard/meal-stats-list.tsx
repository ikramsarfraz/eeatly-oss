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
          href="/history"
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
            <div
              key={meal.mealId}
              className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b px-[18px] py-[11px] last:border-0 hover:bg-[var(--surface-2)]"
            >
              {/* Thumbnail — photo if uploaded, gradient fallback otherwise */}
              <MealThumb
                photoUrl={meal.photoUrl}
                mealName={meal.mealName}
                fallbackIndex={i}
              />

              {/* Info — name links to the recipe view (Round 10). The
                  row's other controls (cook count badge / log-again)
                  stay outside the link so phone taps on either target
                  remain unambiguous. */}
              <div className="min-w-0">
                <Link
                  href={`/meal/${meal.mealId}` as Route}
                  className="block truncate text-[13.5px] font-medium underline-offset-2 hover:underline"
                >
                  {meal.mealName}
                </Link>
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

              {/* Cook count or log-again */}
              {"cookCount" in meal && typeof meal.cookCount === "number" ? (
                <span className="rounded-[6px] bg-[var(--surface-2)] px-[7px] py-[3px] font-mono-brand text-[11.5px] font-medium text-foreground">
                  {meal.cookCount}×
                </span>
              ) : (
                <LogAgainButton
                  mealName={meal.mealName}
                  variant="default"
                  compact
                  iconOnly
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
