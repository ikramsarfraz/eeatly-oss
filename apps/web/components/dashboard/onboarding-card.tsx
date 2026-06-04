import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * No-meals empty-state hint on the dashboard. Formerly the "Welcome to
 * eeatly" onboarding card with its own completion button — the multi-step
 * flow at /onboarding now handles welcome + setup. This card is strictly
 * a "log your first meal" nudge for users who finished onboarding without
 * logging anything.
 */
export function OnboardingCard() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Start with one meal</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <p>
          Type a meal you cooked recently into Quick log. eeatly will start
          surfacing it back to you when it&apos;s worth cooking again.
        </p>
        <p className="text-xs">
          Weeknight repeats, leftovers, low-effort wins — anything counts.
          Under a minute to log.
        </p>
      </CardContent>
    </Card>
  );
}
