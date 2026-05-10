import { format, parseISO } from "date-fns";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { cn } from "@/lib/utils";
import type { RecentMeal } from "@/types";

const thumbColors = [
  "bg-gradient-to-br from-[#d3c0a8] to-[#a8946d]",
  "bg-gradient-to-br from-[#b6cbb3] to-[#6b8869]",
  "bg-gradient-to-br from-[#e8c5a8] to-[#c47a4a]",
  "bg-gradient-to-br from-[#d4c9b0] to-[#8c7a4d]",
  "bg-gradient-to-br from-[#cdd8c8] to-[#7a9272]",
  "bg-gradient-to-br from-[#f0d4ba] to-[#d28a52]"
];

export function RecentHistoryList({ meals }: { meals: RecentMeal[] }) {
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
        <button className="text-[11.5px] text-muted-foreground hover:text-foreground">
          view all
        </button>
      </div>

      <div>
        {meals.length === 0 ? (
          <div className="px-[18px] py-4 text-sm text-muted-foreground">
            Your latest meals will appear here after the first quick log.
          </div>
        ) : null}
        {meals.slice(0, 6).map((meal, i) => (
          <div
            key={meal.id}
            className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b px-[18px] py-[11px] last:border-0 hover:bg-[var(--surface-2)]"
          >
            {/* Thumbnail */}
            <div
              className={cn(
                "h-11 w-11 shrink-0 rounded-[9px]",
                thumbColors[i % thumbColors.length]
              )}
            />

            {/* Info */}
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-medium">{meal.mealName}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                <span>{format(parseISO(meal.cookedAt), "MMM d")}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
                <span>{meal.effortLevel.replace("_", " ")}</span>
                {meal.notes ? (
                  <>
                    <span className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />
                    <span className="truncate italic">&ldquo;{meal.notes}&rdquo;</span>
                  </>
                ) : null}
              </div>
            </div>

            {/* Action */}
            <LogAgainButton mealName={meal.mealName} effortLevel={meal.effortLevel} />
          </div>
        ))}
      </div>
    </div>
  );
}
