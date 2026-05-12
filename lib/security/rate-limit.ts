import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env/server";

let _redis: Redis | null = null;
let _mealMutationLimiter: Ratelimit | null = null;
let _aiCallLimiter: Ratelimit | null = null;

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
    _aiCallLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(20, "1 d"),
      prefix: "rl:ai"
    });
  }
  return _aiCallLimiter;
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
