"use client";

import { Sparkles } from "lucide-react";
import { trackUserEventAction } from "@/actions/analytics";
import { Button } from "@/components/ui/button";
import type { RediscoverySuggestion } from "@/types";

export function RediscoveryTrackButton({
  suggestion
}: {
  suggestion: RediscoverySuggestion;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void trackUserEventAction("rediscovery_clicked", {
          mealId: suggestion.mealId,
          reason: suggestion.reason,
          suggestionKind: suggestion.reason
        });
      }}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Useful idea
    </Button>
  );
}
