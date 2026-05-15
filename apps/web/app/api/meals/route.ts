import { NextResponse } from "next/server";
import { getCurrentHousehold, requireApiUser } from "@/lib/auth/session";
import { trackMealLogLifecycleEvent } from "@/lib/observability/funnel";
import { logger } from "@/lib/observability/logger";
import { checkMealMutationLimit } from "@/lib/security/rate-limit";
import { createMealLog, getDashboardMeals } from "@/services/meals";
import { mealLogInputSchema } from "@/lib/validators/meals";

export async function GET() {
  const user = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const household = await getCurrentHousehold(user.id);
  const meals = await getDashboardMeals(user.id, household.id);

  return NextResponse.json(meals);
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = mealLogInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid meal log.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const household = await getCurrentHousehold(user.id);
    const { mealLog, mealLogCount } = await createMealLog(
      user.id,
      household.id,
      parsed.data
    );
    logger.info("api_meal_log_created", {
      userId: user.id,
      householdId: household.id,
      mealLogId: mealLog?.id
    });
    trackMealLogLifecycleEvent({
      userId: user.id,
      mealLogCount,
      effortLevel: parsed.data.effortLevel,
      source: "quick_log"
    });
    return NextResponse.json({ mealLog }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to log meal." },
      { status: 400 }
    );
  }
}
