import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentMeal } from "@/types";

export function RecentHistoryList({ meals }: { meals: RecentMeal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent meals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {meals.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
              Your latest meals will appear here after the first quick log.
            </div>
          ) : null}
          {meals.slice(0, 6).map((meal) => (
            <div
              key={meal.id}
              className="grid gap-3 rounded-lg border bg-background/60 p-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{meal.mealName}</p>
                  <Badge variant="secondary">{meal.effortLevel.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(parseISO(meal.cookedAt), "MMM d, yyyy")}
                </p>
                {meal.notes ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {meal.notes}
                  </p>
                ) : null}
              </div>
              <LogAgainButton mealName={meal.mealName} effortLevel={meal.effortLevel} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
