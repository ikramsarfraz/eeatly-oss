import Link from "next/link";
import type { Route } from "next";
import { format, parseISO } from "date-fns";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { MealThumb } from "@/components/dashboard/meal-thumb";
import { ShareButton } from "@/components/shares/share-button";
import { attributionLabel } from "@/lib/meals/attribution";
import type { RecentMeal } from "@/types";

export function RecentHistoryList({
  meals,
  currentUserId
}: {
  meals: RecentMeal[];
  currentUserId: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border bg-[var(--surface)]"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between border-b px-[18px] py-4">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          Recent meals{" "}
          <span className="rounded-[5px] bg-[var(--surface-2)] px-[7px] py-px font-mono-brand text-[11px] text-muted-foreground">
            {meals.length}
          </span>
        </h3>
        <Link
          href="/library"
          className="text-[11.5px] text-muted-foreground hover:text-foreground"
          aria-label="View full meal history"
        >
          view all
        </Link>
      </div>

      <div>
        {meals.length === 0 ? (
          <div className="px-[18px] py-4 text-sm text-muted-foreground">
            Your latest meals will appear here after the first quick log.
          </div>
        ) : null}
        {meals.slice(0, 6).map((meal, i) => {
          const attribution = attributionLabel(
            meal.cookedByUserId,
            meal.cookedByName,
            currentUserId
          );
          return (
            // R25 — the whole row navigates to /meal/[id]. The inner
            // Share + Log-again actions stay independently tappable by
            // wrapping them in a `stopPropagation` boundary below, so
            // the user can trigger those without leaving the dashboard.
            // Using <Link> as the row wrapper (rather than `router.push`
            // on an onClick) preserves right-click / open-in-new-tab and
            // makes the row keyboard-navigable for free.
            <Link
              key={meal.id}
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

              {/* Info — name in the same visual weight as before, no
                  longer a separate Link (avoids invalid nested <a>). */}
              <div className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-foreground">
                  {meal.mealName}
                </span>
                <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                  <span>{format(parseISO(meal.cookedAt), "MMM d")}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
                  <span>{meal.effortLevel.replace("_", " ")}</span>
                  {attribution ? (
                    <>
                      <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
                      <span className="truncate">{attribution}</span>
                    </>
                  ) : null}
                  {meal.notes ? (
                    <>
                      <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
                      <span className="truncate italic">&ldquo;{meal.notes}&rdquo;</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Actions — share (subtle) + log again. The boundary
                  div stops click + key propagation so the row's <Link>
                  doesn't fire when the user taps a button. The buttons
                  themselves run their own onClick first (capture/bubble
                  order: button onClick fires, then the wrapper's
                  stopPropagation halts the bubble before the Link
                  navigation triggers). */}
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                  }
                }}
              >
                <ShareButton mealId={meal.mealId} mealName={meal.mealName} variant="icon" />
                <LogAgainButton
                  mealName={meal.mealName}
                  effortLevel={meal.effortLevel}
                  variant="default"
                  compact
                  iconOnly
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
