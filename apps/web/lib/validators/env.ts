import "server-only";

import { getServerEnv, hasR2Env, type ServerEnv } from "@/lib/env/server";

type EnvKey = keyof ServerEnv;

export function getEnv(name: EnvKey) {
  return getServerEnv()[name];
}

export function requireEnv(name: EnvKey) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local before using this service.`);
  }

  return value;
}

export function isDatabaseConfigured() {
  return Boolean(getServerEnv().DATABASE_URL);
}

export function isR2Configured() {
  return hasR2Env();
}
