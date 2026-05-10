"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { trackUserEventAction } from "@/actions/analytics";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";

export function OnboardingCompleteButton() {
  const [pending, setPending] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const { showToast } = useToast();

  async function completeOnboarding() {
    setPending(true);

    try {
      await trackUserEventAction("completed_onboarding", { source: "onboarding_card" });
      setCompleted(true);
      showToast({
        variant: "success",
        title: "Got it",
        description: "Start with one meal whenever you are ready."
      });
    } catch {
      showToast({
        variant: "error",
        title: "Unable to save onboarding",
        description: "You can still log your first meal."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={completeOnboarding}
      disabled={pending || completed}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      {completed ? "Ready to log" : "I know what to log"}
    </Button>
  );
}
