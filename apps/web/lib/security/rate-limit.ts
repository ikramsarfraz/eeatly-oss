import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv, hasRedisEnv } from "@/lib/env/server";
import { getUserTier } from "@/services/ai-credits";

// Rate limiting is backed by Upstash Redis and is OPTIONAL: when Redis isn't
// configured (e.g. local dev, where UPSTASH_REDIS_REST_* are unset) every
// limiter no-ops and requests pass through unthrottled. uat/prod set both
// env vars (each its own database) so the abuse guards are enforced there.
// This mirrors the "inert without env" pattern used for R2/Sentry/PostHog.

let _redis: Redis | null = null;
let _mealMutationLimiter: Ratelimit | null = null;
let _aiCallLimiter: Ratelimit | null = null;
let _aiCallLimiterPro: Ratelimit | null = null;
let _uploadPresignLimiter: Ratelimit | null = null;
let _feedbackLimiter: Ratelimit | null = null;
let _invitationLimiter: Ratelimit | null = null;
let _shareCreationLimiter: Ratelimit | null = null;

// Returns the Redis client, or null when Redis isn't configured (rate
// limiting disabled). Memoized after the first call.
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const env = getServerEnv();
  if (!hasRedisEnv(env)) return null;
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!
  });
  return _redis;
}

function getMealMutationLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_mealMutationLimiter) {
    _mealMutationLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "15 m"),
      prefix: "rl:meal"
    });
  }
  return _mealMutationLimiter;
}

function getAiCallLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_aiCallLimiter) {
    // Burst/abuse guard only — the real quota is AI credits (see
    // services/ai-credits.ts). A daily cap here would block a Pro user's
    // higher allowance, so this is a short rapid-fire window instead.
    _aiCallLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "5 m"),
      prefix: "rl:ai"
    });
  }
  return _aiCallLimiter;
}

function getAiCallLimiterPro(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_aiCallLimiterPro) {
    // Priority AI (Pro perk): a much wider burst window so heavy cooks
    // never hit the abuse guard in normal use. The real ceiling is still
    // their AI-credit grant — this only relaxes rapid-fire throttling.
    _aiCallLimiterPro = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(150, "5 m"),
      prefix: "rl:ai:pro"
    });
  }
  return _aiCallLimiterPro;
}

function getUploadPresignLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_uploadPresignLimiter) {
    _uploadPresignLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "5 m"),
      prefix: "rl:upload-presign"
    });
  }
  return _uploadPresignLimiter;
}

function getFeedbackLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_feedbackLimiter) {
    _feedbackLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "rl:feedback"
    });
  }
  return _feedbackLimiter;
}

export async function checkMealMutationLimit(userId: string): Promise<void> {
  const limiter = getMealMutationLimiter();
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new Error("Too many requests. Please wait a few minutes and try again.");
  }
}

export async function checkAiCallLimit(userId: string): Promise<void> {
  // Skip the tier lookup entirely when rate limiting is disabled.
  if (!getRedis()) return;
  // Pro (incl. the no-card trial) gets priority AI — a wider burst window.
  const tier = await getUserTier(userId);
  const limiter = tier === "pro" ? getAiCallLimiterPro() : getAiCallLimiter();
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new Error("You've hit your daily AI limit. Try again tomorrow.");
  }
}

export async function checkUploadPresignLimit(userId: string): Promise<void> {
  const limiter = getUploadPresignLimiter();
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new Error("Too many upload requests. Please wait a few minutes and try again.");
  }
}

export async function checkFeedbackLimit(userId: string): Promise<void> {
  const limiter = getFeedbackLimiter();
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new Error("Too many feedback submissions in a short time. Please try again later.");
  }
}

function getInvitationLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_invitationLimiter) {
    // Hard daily cap is enforced at the DB layer (10 invitations created
    // per owner per day in services/households.ts). This limiter is the
    // brute-force throttle that fires faster — 20 calls per hour. A
    // legitimate owner sending invites in a burst won't hit it; a
    // scripted abuse path will.
    _invitationLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "rl:invitation"
    });
  }
  return _invitationLimiter;
}

export async function checkInvitationLimit(userId: string): Promise<void> {
  const limiter = getInvitationLimiter();
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new Error("Too many invitations sent in a short time. Please try again later.");
  }
}

function getShareCreationLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_shareCreationLimiter) {
    // Round 7: public share-link creation. `createRecipeShare` is
    // idempotent per (meal, non-revoked) tuple — re-clicking on the
    // same meal returns the existing share. Spam is bounded by household
    // meal count; 20 per day is conservative against scripted abuse
    // without being noticeable for legitimate cooking-burst days.
    _shareCreationLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 d"),
      prefix: "rl:share-create"
    });
  }
  return _shareCreationLimiter;
}

export async function checkShareCreationLimit(userId: string): Promise<void> {
  const limiter = getShareCreationLimiter();
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new Error("Too many share links created today. Try again tomorrow.");
  }
}
