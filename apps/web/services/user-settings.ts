import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userSettings } from "@/db/schema";

/**
 * Per-user sharing & privacy settings. An absent row means all defaults;
 * `getUserSettings` always returns a fully-populated object so callers never
 * branch on null. Every field is enforced server-side by its consumers
 * (link-share gating, reshare permission, inbound-invite gating, email
 * discovery) — none are cosmetic.
 */

export type WhoCanAddYou = "anyone" | "connections" | "no_one";

export type UserSettings = {
  allowLinkShares: boolean;
  cooksCanReshare: boolean;
  whoCanAddYou: WhoCanAddYou;
  findByEmail: boolean;
};

const DEFAULTS: UserSettings = {
  allowLinkShares: true,
  cooksCanReshare: false,
  whoCanAddYou: "connections",
  findByEmail: true
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
    findByEmail: row.findByEmail
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
