"use client";

import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type { RediscoverySuggestion } from "@/types";

export function RediscoveryTrackButton({
  suggestion
}: {
  suggestion: RediscoverySuggestion;
}) {
  const trackEvent = trpc.analytics.trackUserEvent.useMutation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        trackEvent.mutate({
          name: "rediscovery_clicked",
          metadata: {
            mealId: suggestion.mealId,
            reason: suggestion.reason,
            suggestionKind: suggestion.reason
          }
        });
      }}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Useful idea
    </Button>
  );
}
