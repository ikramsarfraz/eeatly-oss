import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env/server";

let _redis: Redis | null = null;
let _mealMutationLimiter: Ratelimit | null = null;
let _aiCallLimiter: Ratelimit | null = null;
let _uploadPresignLimiter: Ratelimit | null = null;
let _feedbackLimiter: Ratelimit | null = null;
let _invitationLimiter: Ratelimit | null = null;
let _shareCreationLimiter: Ratelimit | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const env = getServerEnv();
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    });
  }
  return _redis;
}

function getMealMutationLimiter(): Ratelimit {
  if (!_mealMutationLimiter) {
    _mealMutationLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(60, "15 m"),
      prefix: "rl:meal"
    });
  }
  return _mealMutationLimiter;
}

function getAiCallLimiter(): Ratelimit {
  if (!_aiCallLimiter) {
    // Burst/abuse guard only — the real quota is AI credits (see
    // services/ai-credits.ts). A daily cap here would block a Pro user's
    // higher allowance, so this is a short rapid-fire window instead.
    _aiCallLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, "5 m"),
      prefix: "rl:ai"
    });
  }
  return _aiCallLimiter;
}

function getUploadPresignLimiter(): Ratelimit {
  if (!_uploadPresignLimiter) {
    _uploadPresignLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, "5 m"),
      prefix: "rl:upload-presign"
    });
  }
  return _uploadPresignLimiter;
}

function getFeedbackLimiter(): Ratelimit {
  if (!_feedbackLimiter) {
    _feedbackLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "rl:feedback"
    });
  }
  return _feedbackLimiter;
}

export async function checkMealMutationLimit(userId: string): Promise<void> {
  const { success } = await getMealMutationLimiter().limit(userId);
  if (!success) {
    throw new Error("Too many requests. Please wait a few minutes and try again.");
  }
}

export async function checkAiCallLimit(userId: string): Promise<void> {
  const { success } = await getAiCallLimiter().limit(userId);
  if (!success) {
    throw new Error("You've hit your daily AI limit. Try again tomorrow.");
  }
}

export async function checkUploadPresignLimit(userId: string): Promise<void> {
  const { success } = await getUploadPresignLimiter().limit(userId);
  if (!success) {
    throw new Error("Too many upload requests. Please wait a few minutes and try again.");
  }
}

export async function checkFeedbackLimit(userId: string): Promise<void> {
  const { success } = await getFeedbackLimiter().limit(userId);
  if (!success) {
    throw new Error("Too many feedback submissions in a short time. Please try again later.");
  }
}

function getInvitationLimiter(): Ratelimit {
  if (!_invitationLimiter) {
    // Hard daily cap is enforced at the DB layer (10 invitations created
    // per owner per day in services/households.ts). This limiter is the
    // brute-force throttle that fires faster — 20 calls per hour. A
    // legitimate owner sending invites in a burst won't hit it; a
    // scripted abuse path will.
    _invitationLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "rl:invitation"
    });
  }
  return _invitationLimiter;
}

export async function checkInvitationLimit(userId: string): Promise<void> {
  const { success } = await getInvitationLimiter().limit(userId);
  if (!success) {
    throw new Error("Too many invitations sent in a short time. Please try again later.");
  }
}

function getShareCreationLimiter(): Ratelimit {
  if (!_shareCreationLimiter) {
    // Round 7: public share-link creation. `createRecipeShare` is
    // idempotent per (meal, non-revoked) tuple — re-clicking on the
    // same meal returns the existing share. Spam is bounded by household
    // meal count; 20 per day is conservative against scripted abuse
    // without being noticeable for legitimate cooking-burst days.
    _shareCreationLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(20, "1 d"),
      prefix: "rl:share-create"
    });
  }
  return _shareCreationLimiter;
}

export async function checkShareCreationLimit(userId: string): Promise<void> {
  const { success } = await getShareCreationLimiter().limit(userId);
  if (!success) {
    throw new Error("Too many share links created today. Try again tomorrow.");
  }
}
