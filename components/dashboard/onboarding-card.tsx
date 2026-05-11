import { Badge } from "@/components/ui/badge";
import { OnboardingCompleteButton } from "@/components/dashboard/onboarding-complete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const starterMeals = [
  "Pasta night",
  "Rice bowl",
  "Soup",
  "Tacos",
  "Breakfast for dinner"
];

export function OnboardingCard() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Welcome to eeatly</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground">
        <p>
          Start small: log the kind of meals you actually cook. Weeknight repeats,
          leftovers, and low-effort wins are all useful.
        </p>
        <div className="grid gap-2">
          <p className="font-medium text-foreground">What kinds of meals do you cook?</p>
          <div className="flex flex-wrap gap-2">
            {starterMeals.map((meal) => (
              <Badge key={meal} variant="secondary">
                {meal}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-xs">
          Choose one real dinner you made recently, type the name in Quick log, and you are done in
          under a minute.
        </p>
        <OnboardingCompleteButton />
      </CardContent>
    </Card>
  );
}
