import "server-only";

import { router } from "./trpc";
import { adminRouter } from "./routers/admin";
import { aiRouter } from "./routers/ai";
import { analyticsRouter } from "./routers/analytics";
import { authRouter } from "./routers/auth";
import { billingRouter } from "./routers/billing";
import { dashboardRouter } from "./routers/dashboard";
import { feedbackRouter } from "./routers/feedback";
import { healthRouter } from "./routers/health";
import { householdsRouter } from "./routers/households";
import { mealsRouter } from "./routers/meals";
import { notificationsRouter } from "./routers/notifications";
import { onboardingRouter } from "./routers/onboarding";
import { plansRouter } from "./routers/plans";
import { searchRouter } from "./routers/search";
import { sharesRouter } from "./routers/shares";
import { urlPreviewRouter } from "./routers/url-preview";

/**
 * Root tRPC router. Domain routers (meals, households, plans, …) get
 * merged in as Tasks 2-4 land. Keeping the root small means the
 * `AppRouter` type the web client imports stays a stable surface even
 * as we move procedures around.
 *
 * Round 11 / Task 2: read procedures landed for every domain in the
 * handoff. Mutation procedures land in Tasks 3 + 4.
 */
export const appRouter = router({
  admin: adminRouter,
  ai: aiRouter,
  analytics: analyticsRouter,
  auth: authRouter,
  billing: billingRouter,
  dashboard: dashboardRouter,
  feedback: feedbackRouter,
  health: healthRouter,
  households: householdsRouter,
  meals: mealsRouter,
  notifications: notificationsRouter,
  onboarding: onboardingRouter,
  plans: plansRouter,
  search: searchRouter,
  shares: sharesRouter,
  urlPreview: urlPreviewRouter
});

export type AppRouter = typeof appRouter;
