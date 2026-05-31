import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userSettings } from "@/db/schema";
import {
  asMeasurementSystem,
  type MeasurementSystem
} from "@/lib/units/detect";

/**
 * Per-user settings (sharing & privacy + kitchen preferences). An absent
 * row means all defaults; `getUserSettings` always returns a fully-populated
 * object so callers never branch on null. Every field is enforced
 * server-side by its consumers (link-share gating, reshare permission,
 * inbound-invite gating, email discovery, AI units bias) — none are cosmetic.
 */

export type WhoCanAddYou = "anyone" | "connections" | "no_one";

export type UserSettings = {
  allowLinkShares: boolean;
  cooksCanReshare: boolean;
  whoCanAddYou: WhoCanAddYou;
  findByEmail: boolean;
  measurementSystem: MeasurementSystem;
};

const DEFAULTS: UserSettings = {
  allowLinkShares: true,
  cooksCanReshare: false,
  whoCanAddYou: "connections",
  findByEmail: true,
  measurementSystem: "metric"
};

function normalizeWhoCanAddYou(value: string): WhoCanAddYou {
  return value === "anyone" || value === "no_one" ? value : "connections";
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  if (!row) return { ...DEFAULTS };
  return {
    allowLinkShares: row.allowLinkShares,
    cooksCanReshare: row.cooksCanReshare,
    whoCanAddYou: normalizeWhoCanAddYou(row.whoCanAddYou),
    findByEmail: row.findByEmail,
    measurementSystem:
      asMeasurementSystem(row.measurementSystem) ?? DEFAULTS.measurementSystem
  };
}

export async function updateUserSettings(
  userId: string,
  patch: Partial<UserSettings>
): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const next: UserSettings = { ...current, ...patch };
  await db
    .insert(userSettings)
    .values({ userId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...next, updatedAt: new Date() }
    });
  return next;
}

/**
 * Persist the signup-time inferred measurement default WITHOUT clobbering a
 * row the user has already touched. Used by the Better Auth `user.create`
 * hook: inserts a fresh row carrying the inferred system, or — if a row
 * somehow already exists — updates only `measurement_system`, leaving the
 * privacy fields at whatever they were. Idempotent and failure-isolated by
 * the caller. We never overwrite a non-default the user may have set,
 * because at signup time no row exists yet (this is the first write).
 */
export async function seedMeasurementSystem(
  userId: string,
  system: MeasurementSystem
): Promise<void> {
  await db
    .insert(userSettings)
    .values({
      userId,
      allowLinkShares: DEFAULTS.allowLinkShares,
      cooksCanReshare: DEFAULTS.cooksCanReshare,
      whoCanAddYou: DEFAULTS.whoCanAddYou,
      findByEmail: DEFAULTS.findByEmail,
      measurementSystem: system,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      // Only touch the units column on conflict; never reset privacy fields.
      set: { measurementSystem: system, updatedAt: sql`now()` }
    });
}
