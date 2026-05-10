import { Clock, Flame, History, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogAgainButton } from "@/components/dashboard/log-again-button";
import { RediscoveryTrackButton } from "@/components/dashboard/rediscovery-track-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDaysAgo } from "@/lib/utils";
import type { RediscoverySuggestion } from "@/types";

const icons = {
  neglected: History,
  frequent: Flame,
  quick: Zap,
  favorite: Sparkles
};

export function RediscoverySuggestions({
  suggestions
}: {
  suggestions: RediscoverySuggestion[];
}) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ideas for tonight</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>Log a few meals and CookLoop will start resurfacing good options.</p>
          <p className="text-xs">
            Repeats, quick dinners, and neglected favorites will all show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {suggestions.map((suggestion) => {
        const Icon = icons[suggestion.reason];

        return (
          <Card key={suggestion.id} className="overflow-hidden transition-colors hover:bg-muted/30">
            <CardContent className="grid gap-4 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {suggestion.title}
                    </p>
                    <h3 className="text-lg font-semibold leading-tight">
                      {suggestion.mealName}
                    </h3>
                  </div>
                </div>
                {suggestion.effortLevel ? (
                  <Badge className="w-fit" variant="warm">
                    {suggestion.effortLevel.replace("_", " ")}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {suggestion.daysSinceCooked !== null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Last cooked {formatDaysAgo(suggestion.daysSinceCooked)}
                  </div>
                ) : (
                  <span className="hidden sm:block" aria-hidden />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <LogAgainButton
                    mealName={suggestion.mealName}
                    effortLevel={suggestion.effortLevel}
                    variant="default"
                    size="sm"
                  />
                  <RediscoveryTrackButton suggestion={suggestion} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
