import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import type { FeatureKey } from "@/lib/gates/registry";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import {
  checkAiCallLimit,
  checkFeedbackLimit,
  checkInvitationLimit,
  checkMealMutationLimit,
  checkShareCreationLimit,
  checkUploadPresignLimit
} from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability/logger";
import {
  requireHouseholdMember,
  requireHouseholdOwner
} from "@/lib/auth/session";
import type { TRPCContext } from "./context";

/**
 * tRPC root. `superjson` is the transformer so `Date` / `Set` / `Map`
 * survive the wire — matches what server actions did invisibly via
 * the React-flight serializer.
 *
 * Zod errors are surfaced as BAD_REQUEST with the flattened issue list
 * in `cause.zodIssues`, so the client can render field-level messages
 * without a second `safeParse`. Domain-specific errors layer on top
 * via the middleware below; the `errorFormatter` only handles input
 * validation here.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodIssues:
          error.cause instanceof ZodError ? error.cause.flatten().fieldErrors : null
      }
    };
  }
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public — no auth. The base every other builder extends.
 */
export const publicProcedure = t.procedure;

/**
 * Auth middleware. Reads `ctx.user` (populated by `createTRPCContext`)
 * and refuses with UNAUTHORIZED when absent. Narrows the user type
 * downstream so procedures don't need a non-null check.
 */
const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You need to be signed in.",
      cause: { reason: "UNAUTHENTICATED" }
    });
  }
  return next({
    ctx: { ...ctx, user: ctx.user }
  });
});

/**
 * Protected — requires `ctx.user`. The successor to most existing
 * `await requireCurrentUser()` first-line guards.
 */
export const protectedProcedure = t.procedure.use(requireAuth);

/**
 * Admin — requires `ctx.user.role === "platform_admin"`. We do NOT
 * enforce the host-restriction `PLATFORM_ADMIN_HOST` check here; the
 * web-only admin layout still does that (since it's tied to the
 * request host). Procedures called outside the admin host but with an
 * admin role still succeed — that matters for the mobile-API surface.
 */
const requireAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", cause: { reason: "UNAUTHENTICATED" } });
  }
  if (ctx.user.role !== "platform_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
      cause: { reason: "FORBIDDEN_ROLE" }
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = t.procedure.use(requireAdmin);

/**
 * Household-member middleware. The procedure's input determines which
 * household to check:
 *   - Input has `householdId` (string) → check against that.
 *   - Otherwise → fall back to the user's current household (lazy
 *     resolution via `ctx.getCurrentHousehold`).
 *
 * Attaches `ctx.household` for downstream use. Procedures that need a
 * different household than the user's current one MUST pass it in via
 * `householdId` in their input schema.
 */
const requireHouseholdMembership = t.middleware(async ({ ctx, getRawInput, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", cause: { reason: "UNAUTHENTICATED" } });
  }

  // Middleware runs BEFORE `.input()` parsing in tRPC v11 — `input` at
  // this point would be undefined regardless of what the procedure
  // declares. `getRawInput()` returns the un-parsed body. We only
  // peek at `householdId` (a string) and let the procedure's own
  // schema validate everything else downstream.
  const raw = (await getRawInput()) as unknown;
  let householdId: string;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "householdId" in raw &&
    typeof (raw as { householdId: unknown }).householdId === "string"
  ) {
    householdId = (raw as { householdId: string }).householdId;
  } else {
    const household = await ctx.getCurrentHousehold();
    householdId = household.id;
  }

  try {
    await requireHouseholdMember(ctx.user.id, householdId);
  } catch {
    // requireHouseholdMember throws a generic Error with a logged
    // "unauthorized_household_access" line. We don't distinguish 403
    // vs 404 on the wire — same stance as `/meal/[id]` (Round 10):
    // returning a different shape for non-members would let an
    // attacker enumerate household ids.
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Not found.",
      cause: { reason: "NOT_HOUSEHOLD_MEMBER" }
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      household: { id: householdId }
    }
  });
});

export const householdMemberProcedure = t.procedure.use(requireHouseholdMembership);

/**
 * Household-owner middleware. Layers on top of `householdMemberProcedure`.
 * The shape of `requireHouseholdOwner` mirrors `requireHouseholdMember`
 * — throws `NotHouseholdOwnerError` rather than the generic Error.
 */
const requireOwner = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", cause: { reason: "UNAUTHENTICATED" } });
  }
  // `ctx.household` is populated by the upstream household-member
  // middleware. TS narrows from there.
  const household = (ctx as TRPCContext & { household?: { id: string } }).household;
  if (!household) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "householdOwnerProcedure must compose on householdMemberProcedure."
    });
  }
  try {
    await requireHouseholdOwner(ctx.user.id, household.id);
  } catch {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the household owner can do that.",
      cause: { reason: "NOT_HOUSEHOLD_OWNER" }
    });
  }
  return next();
});

export const householdOwnerProcedure = householdMemberProcedure.use(requireOwner);

/**
 * Feature-gate factory. Returns a procedure that first authenticates,
 * then runs `requireFeatureAccess`. Denials become FORBIDDEN with a
 * structured `cause` the UI uses to render the right upgrade prompt.
 */
export function gatedProcedure(feature: FeatureKey) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    try {
      await requireFeatureAccess(ctx.user.id, feature);
    } catch (error) {
      if (error instanceof FeatureGateDeniedError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: error.message,
          cause: { reason: "UPGRADE_REQUIRED", feature: error.feature }
        });
      }
      throw error;
    }
    return next();
  });
}

/**
 * Rate-limit factory. Maps `kind` to the existing limiter helper. On
 * denial we surface TOO_MANY_REQUESTS with a structured cause; we do
 * NOT include a precise retry timestamp because Upstash's sliding-
 * window response doesn't give us one cheaply, and the existing
 * user-facing copy doesn't carry seconds either.
 */
export type RateLimitKind =
  | "ai"
  | "mutation"
  | "upload"
  | "feedback"
  | "invitation"
  | "share";

const RATE_LIMIT_HELPERS: Record<RateLimitKind, (userId: string) => Promise<void>> = {
  ai: checkAiCallLimit,
  mutation: checkMealMutationLimit,
  upload: checkUploadPresignLimit,
  feedback: checkFeedbackLimit,
  invitation: checkInvitationLimit,
  share: checkShareCreationLimit
};

export function rateLimit(kind: RateLimitKind) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", cause: { reason: "UNAUTHENTICATED" } });
    }
    try {
      await RATE_LIMIT_HELPERS[kind](ctx.user.id);
    } catch (error) {
      // The helpers throw a plain Error with user-facing copy; reuse
      // that copy verbatim per the Round 11 ground rule about not
      // rewriting strings.
      const message =
        error instanceof Error ? error.message : "Too many requests.";
      logger.warn("trpc_rate_limited", { kind, userId: ctx.user.id });
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message,
        cause: { reason: "RATE_LIMITED", kind }
      });
    }
    return next();
  });
}
