import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { resolveOnboardingPath } from "@/lib/onboarding/path";

export const metadata: Metadata = {
  title: "Welcome to eeatly",
  description: "Set up your cooking memory in under a minute."
};

export default async function OnboardingPage() {
  const user = await requireCurrentUser();

  // Path detection + the onboarding-state read run in parallel; both
  // are independent reads keyed on the user id.
  const [pathContext, row] = await Promise.all([
    resolveOnboardingPath(user.id),
    db
      .select({
        onboardingCompletedAt: users.onboardingCompletedAt,
        cooksPerWeek: users.cooksPerWeek,
        weeknightEffort: users.weeknightEffort
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
  ]);
  const onboarding = row[0];

  // If they've already finished, don't make them redo it.
  if (onboarding?.onboardingCompletedAt) {
    redirect("/home");
  }

  return (
    <OnboardingFlow
      name={user.name}
      initialHabits={{
        cooksPerWeek: onboarding?.cooksPerWeek ?? null,
        weeknightEffort: onboarding?.weeknightEffort ?? null
      }}
      path={pathContext.path}
      householdName={pathContext.householdName}
    />
  );
}
