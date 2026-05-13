"use client";

import * as React from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { useCreateMealLog } from "@/hooks/use-dashboard-meals";
import type { EffortLevel } from "@/types";

type LogAgainButtonProps = {
  mealName: string;
  effortLevel?: EffortLevel | null;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm";
  compact?: boolean;
  label?: string;
  icon?: "rotate" | "check";
};

export function LogAgainButton({
  mealName,
  effortLevel = "easy",
  variant = "outline",
  size = "sm",
  compact = false,
  label = "Log again",
  icon = "rotate"
}: LogAgainButtonProps) {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const mutation = useCreateMealLog({ source: "log_again" });
  const { showToast } = useToast();

  async function logAgain() {
    setErrorMessage(null);

    try {
      await mutation.mutateAsync({
        mealName,
        effortLevel: effortLevel ?? "easy",
        notes: "",
        cookedDate: new Date().toISOString().slice(0, 10),
        photoUrl: ""
      });

      showToast({
        variant: "success",
        title: `"${mealName}" logged`,
        description: `Saved for ${new Date().toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric"
        })}`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log meal.";
      setErrorMessage(message);

      showToast({
        variant: "error",
        title: "Log again failed",
        description: message
      });
    }
  }

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={logAgain}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : icon === "check" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>
      {!compact && (
        errorMessage ? (
          <p className="text-xs text-destructive" role="status">
            {errorMessage}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Defaults to today with your last-known effort.</p>
        )
      )}
    </div>
  );
}
