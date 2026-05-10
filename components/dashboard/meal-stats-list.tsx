import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MealStat } from "@/types";

export function MealStatsList({
  title,
  meals
}: {
  title: string;
  meals: MealStat[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {meals.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
              This fills in automatically as you repeat meals.
            </div>
          ) : null}
          {meals.slice(0, 5).map((meal) => (
            (() => {
              const daysAgo = differenceInCalendarDays(new Date(), parseISO(meal.lastCookedAt));

              return (
                <div
                  key={meal.mealId}
                  className="grid gap-3 rounded-lg border bg-background/60 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{meal.mealName}</p>
                      {daysAgo >= 14 ? (
                        <Badge variant="outline">not cooked in {daysAgo} days</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last cooked {format(parseISO(meal.lastCookedAt), "MMM d")}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 sm:justify-end">
                    <div className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
                      {meal.cookCount}x
                    </div>
                    <LogAgainButton mealName={meal.mealName} />
                  </div>
                </div>
              );
            })()
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
