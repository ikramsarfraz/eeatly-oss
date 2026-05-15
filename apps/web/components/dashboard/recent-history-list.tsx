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
          href="/history"
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
          <div
            key={meal.id}
            className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b px-[18px] py-[11px] last:border-0 hover:bg-[var(--surface-2)]"
          >
            {/* Thumbnail — photo if uploaded, gradient fallback otherwise */}
            <MealThumb
              photoUrl={meal.photoUrl}
              mealName={meal.mealName}
              fallbackIndex={i}
            />

            {/* Info — name links to /meal/[id]; the row's other actions
                (share + log again) stay independently tappable. */}
            <div className="min-w-0">
              <Link
                href={`/meal/${meal.mealId}` as Route}
                className="block truncate text-[13.5px] font-medium underline-offset-2 hover:underline"
              >
                {meal.mealName}
              </Link>
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

            {/* Actions — share (subtle) + log again. The icon-only
                share keeps the row visually quiet while still being
                discoverable for the killer "mom shares Eid recipe to
                family WhatsApp" flow. */}
            <div className="flex items-center gap-1">
              <ShareButton mealId={meal.mealId} mealName={meal.mealName} variant="icon" />
              <LogAgainButton
                mealName={meal.mealName}
                effortLevel={meal.effortLevel}
                variant="default"
                compact
                iconOnly
              />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
