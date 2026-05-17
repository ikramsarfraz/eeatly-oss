import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, max, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import {
  mealIngredients,
  meals,
  mealLogs,
  recipeSteps,
  refinePendingChanges,
  refineSessions,
  refineTurns
} from "@/db/schema";
import {
  pendingChangeSchema,
  type PendingChange,
  type HeadsUp
} from "@eeatly/api/validators/refine";
import {
  proposeChangesFromText as aiProposeText,
  proposeChangesFromVoice as aiProposeVoice,
  proposeChangesFromPhoto as aiProposePhoto,
  type RecipeContext
} from "./ai-refine";
import { detectHeadsUp } from "@/lib/refine/heads-up-rules";

/**
 * Round 18 — Refine recipe service layer.
 *
 * Wraps the new refine tables + the AI proposal service into a small
 * set of operations the tRPC router calls into:
 *
 *   - startSession        — create or resume the active session
 *   - submit*Turn         — text / voice / photo prompt; calls AI;
 *                            writes turn + pending rows
 *   - toggleTurnAccepted  — flip accept flag; recompute pending rows
 *   - getSessionState     — turns + pending + heads-up for the UI
 *   - save                — apply pending in a transaction
 *   - discard             — close session without applying
 *
 * Authz is layered: tRPC procedures enforce protectedProcedure (auth),
 * the service calls `requireHouseholdMember` against the meal's
 * household, and sessions also assert user ownership (a different
 * member can't fetch/save another member's draft).
 */

const ACTIVE_STATUS = "active" as const;
const SAVED_STATUS = "saved" as const;
const DISCARDED_STATUS = "discarded" as const;

// Synthetic id prefix used by loadRecipeContext when a meal has no
// structured `meal_ingredients` rows yet — the position-indexed id lets
// the AI diff against legacy `meals.ingredients[]` entries. The save
// path materialises these into real rows and remaps refIds before
// applying changes.
const LEGACY_INGREDIENT_PREFIX = "legacy-ingredient-";

function isLegacyIngredientId(id: string): boolean {
  return id.startsWith(LEGACY_INGREDIENT_PREFIX);
}

export type SessionState = {
  sessionId: string;
  mealId: string;
  startedAt: Date;
  turns: Array<{
    id: string;
    position: number;
    source: "text" | "voice" | "photo";
    prompt: string;
    attachmentUrl: string | null;
    proposed: PendingChange[];
    accepted: boolean;
    createdAt: Date;
  }>;
  pendingChanges: PendingChange[];
  summary: { additions: number; changes: number; removals: number };
  headsUp: HeadsUp[];
};

/* ─── Internal helpers ──────────────────────────────────────────── */

async function loadRecipeContext(mealId: string): Promise<RecipeContext> {
  const mealRow = await db.query.meals.findFirst({
    where: and(eq(meals.id, mealId), isNull(meals.archivedAt))
  });
  if (!mealRow) throw new Error("Meal not found.");

  // Effort comes from the meal logs' modal value — same derivation as
  // `services/meals.ts:getMealDetail`. Inline here so we don't tangle
  // imports.
  const effortRows = await db
    .select({
      effortLevel: mealLogs.effortLevel,
      n: count(mealLogs.id)
    })
    .from(mealLogs)
    .where(
      and(
        eq(mealLogs.mealId, mealId),
        eq(mealLogs.householdId, mealRow.householdId),
        isNull(mealLogs.deletedAt)
      )
    )
    .groupBy(mealLogs.effortLevel);
  const effortLevel = pickModalEffort(effortRows);

  const [ingredientRows, stepRows] = await Promise.all([
    db
      .select()
      .from(mealIngredients)
      .where(eq(mealIngredients.mealId, mealId))
      .orderBy(asc(mealIngredients.position)),
    db
      .select()
      .from(recipeSteps)
      .where(eq(recipeSteps.mealId, mealId))
      .orderBy(asc(recipeSteps.position))
  ]);

  // If structured ingredient rows haven't been populated yet for this
  // meal, synthesise a degenerate set from the legacy `meals.ingredients`
  // text[] so the AI still has something to diff against. The Refine
  // save path will write structured rows that supersede this.
  const ingredients =
    ingredientRows.length > 0
      ? ingredientRows.map((r) => ({
          id: r.id,
          position: r.position,
          name: r.name,
          quantityString: r.quantityString,
          prepNote: r.prepNote
        }))
      : (mealRow.ingredients ?? []).map((line, idx) => ({
          id: `${LEGACY_INGREDIENT_PREFIX}${idx}`,
          position: idx,
          name: line,
          quantityString: "",
          prepNote: null
        }));

  const steps = stepRows.map((r) => ({
    id: r.id,
    position: r.position,
    title: r.title,
    time: r.time,
    body: r.body,
    ingredientIds: r.ingredientIds
  }));

  return {
    id: mealRow.id,
    name: mealRow.name,
    effortLevel,
    ingredients,
    steps
  };
}

function pickModalEffort(
  rows: ReadonlyArray<{
    effortLevel: "quick" | "easy" | "medium" | "high_effort";
    n: number;
  }>
): "quick" | "easy" | "medium" | "high_effort" | null {
  if (rows.length === 0) return null;
  const weight: Record<"quick" | "easy" | "medium" | "high_effort", number> = {
    quick: 0,
    easy: 1,
    medium: 2,
    high_effort: 3
  };
  let best = rows[0];
  for (const r of rows) {
    if (
      Number(r.n) > Number(best.n) ||
      (Number(r.n) === Number(best.n) &&
        weight[r.effortLevel] > weight[best.effortLevel])
    ) {
      best = r;
    }
  }
  return best.effortLevel;
}

async function ensureSessionOwnership(
  sessionId: string,
  userId: string
): Promise<{
  id: string;
  mealId: string;
  status: string;
}> {
  const session = await db.query.refineSessions.findFirst({
    where: eq(refineSessions.id, sessionId)
  });
  if (!session) throw new Error("Refine session not found.");
  if (session.userId !== userId) {
    logger.warn("refine_unauthorized_session_access", {
      sessionId,
      userId,
      ownerId: session.userId
    });
    throw new Error("Not authorized for this refine session.");
  }
  return {
    id: session.id,
    mealId: session.mealId,
    status: session.status
  };
}

function summariseChanges(pending: PendingChange[]) {
  let additions = 0;
  let changes = 0;
  let removals = 0;
  for (const p of pending) {
    if (p.kind === "add") additions += 1;
    else if (p.kind === "change") changes += 1;
    else removals += 1;
  }
  return { additions, changes, removals };
}

function parseProposed(value: unknown): PendingChange[] {
  if (!Array.isArray(value)) return [];
  const out: PendingChange[] = [];
  for (const raw of value) {
    const parsed = pendingChangeSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/* ─── Public service surface ────────────────────────────────────── */

export async function startSession(args: {
  userId: string;
  mealId: string;
  deviceId: string;
}): Promise<SessionState> {
  // Authorize: user must be in the meal's household. The lookup also
  // gives us the household id which the AI context fetcher needs later.
  const mealRow = await db.query.meals.findFirst({
    where: and(eq(meals.id, args.mealId), isNull(meals.archivedAt))
  });
  if (!mealRow) throw new Error("Meal not found.");
  await requireHouseholdMember(args.userId, mealRow.householdId);

  // Resume the active session if there is one, else insert.
  const existing = await db.query.refineSessions.findFirst({
    where: and(
      eq(refineSessions.mealId, args.mealId),
      eq(refineSessions.userId, args.userId),
      eq(refineSessions.deviceId, args.deviceId),
      eq(refineSessions.status, ACTIVE_STATUS)
    )
  });

  let sessionId: string;
  let startedAt: Date;
  if (existing) {
    sessionId = existing.id;
    startedAt = existing.startedAt;
    await db
      .update(refineSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(refineSessions.id, existing.id));
  } else {
    const [inserted] = await db
      .insert(refineSessions)
      .values({
        id: randomUUID(),
        mealId: args.mealId,
        userId: args.userId,
        deviceId: args.deviceId,
        status: ACTIVE_STATUS
      })
      .returning();
    sessionId = inserted.id;
    startedAt = inserted.startedAt;
  }

  return loadSessionState({ sessionId, mealId: args.mealId, startedAt });
}

export async function getSessionState(args: {
  userId: string;
  sessionId: string;
}): Promise<SessionState> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  return loadSessionState({
    sessionId: session.id,
    mealId: session.mealId,
    startedAt: new Date() // ignored downstream; refetched below
  });
}

async function loadSessionState(args: {
  sessionId: string;
  mealId: string;
  startedAt: Date;
}): Promise<SessionState> {
  const [sessionRow, turnRows, pendingRows] = await Promise.all([
    db.query.refineSessions.findFirst({
      where: eq(refineSessions.id, args.sessionId)
    }),
    db
      .select()
      .from(refineTurns)
      .where(eq(refineTurns.sessionId, args.sessionId))
      .orderBy(asc(refineTurns.position)),
    db
      .select()
      .from(refinePendingChanges)
      .where(eq(refinePendingChanges.sessionId, args.sessionId))
  ]);

  const turns = turnRows.map((row) => ({
    id: row.id,
    position: row.position,
    source: row.source as "text" | "voice" | "photo",
    prompt: row.prompt,
    attachmentUrl: row.attachmentUrl,
    proposed: parseProposed(row.proposed),
    accepted: row.accepted,
    createdAt: row.createdAt
  }));
  const pendingChanges = pendingRows.flatMap((row) =>
    parseProposed([pendingRowToChange(row)])
  );

  const recipe = await loadRecipeContext(args.mealId);
  const headsUp = detectHeadsUp(recipe, pendingChanges);

  return {
    sessionId: args.sessionId,
    mealId: args.mealId,
    startedAt: sessionRow?.startedAt ?? args.startedAt,
    turns,
    pendingChanges,
    summary: summariseChanges(pendingChanges),
    headsUp
  };
}

function pendingRowToChange(row: typeof refinePendingChanges.$inferSelect) {
  if (row.kind === "add") {
    return {
      id: row.id,
      kind: "add",
      target: row.target,
      payload: row.payload ?? {},
      whereHint: row.whereHint ?? undefined
    };
  }
  if (row.kind === "change") {
    return {
      id: row.id,
      kind: "change",
      target: row.target,
      refId: row.refId ?? "",
      field: row.field ?? "",
      before: row.before,
      after: row.after
    };
  }
  return {
    id: row.id,
    kind: "remove",
    target: row.target,
    refId: row.refId ?? "",
    before: row.before
  };
}

/* ─── Turn submission ───────────────────────────────────────────── */

async function nextTurnPosition(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ p: max(refineTurns.position) })
    .from(refineTurns)
    .where(eq(refineTurns.sessionId, sessionId));
  return (row?.p ?? -1) + 1;
}

async function persistTurnAndRecompute(args: {
  sessionId: string;
  source: "text" | "voice" | "photo";
  prompt: string;
  attachmentUrl: string | null;
  proposed: PendingChange[];
}): Promise<{ turnId: string }> {
  const position = await nextTurnPosition(args.sessionId);
  const turnId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(refineTurns).values({
      id: turnId,
      sessionId: args.sessionId,
      position,
      source: args.source,
      prompt: args.prompt,
      attachmentUrl: args.attachmentUrl,
      proposed: args.proposed,
      accepted: true
    });
    // Append to pending. The recompute happens via toggleTurnAccepted;
    // initial state is accepted=true so we go ahead and write rows.
    if (args.proposed.length > 0) {
      await tx.insert(refinePendingChanges).values(
        args.proposed.map((p) => changeToPendingRow(p, args.sessionId, turnId))
      );
    }
    await tx
      .update(refineSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(refineSessions.id, args.sessionId));
  });

  return { turnId };
}

function changeToPendingRow(
  change: PendingChange,
  sessionId: string,
  turnId: string
) {
  const base = {
    id: randomUUID(),
    sessionId,
    turnId,
    kind: change.kind,
    target: change.target
  };
  if (change.kind === "add") {
    return {
      ...base,
      refId: null,
      field: null,
      before: null,
      after: null,
      payload: change.payload as unknown,
      whereHint: change.whereHint ?? null
    };
  }
  if (change.kind === "change") {
    return {
      ...base,
      refId: change.refId,
      field: change.field,
      before: change.before as unknown,
      after: change.after as unknown,
      payload: null,
      whereHint: null
    };
  }
  return {
    ...base,
    refId: change.refId,
    field: null,
    before: change.before as unknown,
    after: null,
    payload: null,
    whereHint: null
  };
}

export async function submitTextTurn(args: {
  userId: string;
  sessionId: string;
  prompt: string;
}): Promise<SessionState> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  if (session.status !== ACTIVE_STATUS) {
    throw new Error("Refine session is closed.");
  }
  const recipe = await loadRecipeContext(session.mealId);
  const proposal = await aiProposeText({
    userId: args.userId,
    recipe,
    prompt: args.prompt
  });
  await persistTurnAndRecompute({
    sessionId: session.id,
    source: "text",
    prompt: args.prompt,
    attachmentUrl: null,
    proposed: proposal.proposed
  });
  return loadSessionState({
    sessionId: session.id,
    mealId: session.mealId,
    startedAt: new Date()
  });
}

export async function submitVoiceTurn(args: {
  userId: string;
  sessionId: string;
  audioBuffer: Buffer;
  mediaType: string;
  fileName?: string;
  /** Optional persisted attachment URL (R2). When undefined, the audio
   *  is one-shot in-memory and not retained. */
  attachmentUrl?: string;
}): Promise<SessionState & { transcript: string }> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  if (session.status !== ACTIVE_STATUS) {
    throw new Error("Refine session is closed.");
  }
  const recipe = await loadRecipeContext(session.mealId);
  const proposal = await aiProposeVoice({
    userId: args.userId,
    recipe,
    audioBuffer: args.audioBuffer,
    mediaType: args.mediaType,
    fileName: args.fileName
  });
  await persistTurnAndRecompute({
    sessionId: session.id,
    source: "voice",
    prompt: proposal.transcript,
    attachmentUrl: args.attachmentUrl ?? null,
    proposed: proposal.proposed
  });
  const state = await loadSessionState({
    sessionId: session.id,
    mealId: session.mealId,
    startedAt: new Date()
  });
  return { ...state, transcript: proposal.transcript };
}

export async function submitPhotoTurn(args: {
  userId: string;
  sessionId: string;
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  attachmentUrl?: string;
}): Promise<SessionState> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  if (session.status !== ACTIVE_STATUS) {
    throw new Error("Refine session is closed.");
  }
  const recipe = await loadRecipeContext(session.mealId);
  const proposal = await aiProposePhoto({
    userId: args.userId,
    recipe,
    imageBase64: args.imageBase64,
    mediaType: args.mediaType
  });
  await persistTurnAndRecompute({
    sessionId: session.id,
    source: "photo",
    prompt: "Photo refinement",
    attachmentUrl: args.attachmentUrl ?? null,
    proposed: proposal.proposed
  });
  return loadSessionState({
    sessionId: session.id,
    mealId: session.mealId,
    startedAt: new Date()
  });
}

/* ─── Accept / reject toggling ──────────────────────────────────── */

export async function toggleTurnAccepted(args: {
  userId: string;
  sessionId: string;
  turnId: string;
  accepted: boolean;
}): Promise<SessionState> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  if (session.status !== ACTIVE_STATUS) {
    throw new Error("Refine session is closed.");
  }
  // Flip the turn's accepted flag, then recompute the pending rows
  // from every accepted turn in the session.
  await db.transaction(async (tx) => {
    await tx
      .update(refineTurns)
      .set({ accepted: args.accepted })
      .where(
        and(eq(refineTurns.id, args.turnId), eq(refineTurns.sessionId, session.id))
      );
    await tx
      .delete(refinePendingChanges)
      .where(eq(refinePendingChanges.sessionId, session.id));
    const acceptedTurns = await tx
      .select()
      .from(refineTurns)
      .where(
        and(
          eq(refineTurns.sessionId, session.id),
          eq(refineTurns.accepted, true)
        )
      )
      .orderBy(asc(refineTurns.position));
    const rows = acceptedTurns.flatMap((t) =>
      parseProposed(t.proposed).map((c) =>
        changeToPendingRow(c, session.id, t.id)
      )
    );
    if (rows.length > 0) {
      await tx.insert(refinePendingChanges).values(rows);
    }
  });

  return loadSessionState({
    sessionId: session.id,
    mealId: session.mealId,
    startedAt: new Date()
  });
}

/* ─── Save + discard ────────────────────────────────────────────── */

export async function discardSession(args: {
  userId: string;
  sessionId: string;
}): Promise<{ discarded: true }> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  if (session.status === SAVED_STATUS) {
    throw new Error("Session already saved.");
  }
  await db
    .update(refineSessions)
    .set({ status: DISCARDED_STATUS, discardedAt: new Date() })
    .where(eq(refineSessions.id, session.id));
  return { discarded: true };
}

export type SaveResult = {
  mealId: string;
  applied: number;
};

export async function saveSession(args: {
  userId: string;
  sessionId: string;
}): Promise<SaveResult> {
  const session = await ensureSessionOwnership(args.sessionId, args.userId);
  if (session.status === SAVED_STATUS) {
    throw new Error("Session already saved.");
  }
  if (session.status === DISCARDED_STATUS) {
    throw new Error("Session was discarded.");
  }

  // Authz: still in the meal's household.
  const mealRow = await db.query.meals.findFirst({
    where: and(eq(meals.id, session.mealId), isNull(meals.archivedAt))
  });
  if (!mealRow) throw new Error("Meal not found.");
  await requireHouseholdMember(args.userId, mealRow.householdId);

  const pending = await db
    .select()
    .from(refinePendingChanges)
    .where(eq(refinePendingChanges.sessionId, session.id))
    .orderBy(asc(refinePendingChanges.createdAt));

  if (pending.length === 0) {
    // Idempotent: a save call with nothing to apply just closes the
    // session and returns 0 applied.
    await db
      .update(refineSessions)
      .set({ status: SAVED_STATUS, savedAt: new Date() })
      .where(eq(refineSessions.id, session.id));
    return { mealId: session.mealId, applied: 0 };
  }

  await db.transaction(async (tx) => {
    // Parse pending up-front so we can scan for legacy-ingredient refs
    // before applying anything.
    const parsedChanges = pending
      .map((row) => parseProposed([pendingRowToChange(row)])[0])
      .filter((c): c is PendingChange => Boolean(c));

    // If any change targets a synthetic `legacy-ingredient-N` id,
    // materialise `meals.ingredients[]` into real `meal_ingredients`
    // rows inside this transaction so updates/deletes target valid
    // UUIDs. Rolls back with the rest of the save on failure.
    const referencesLegacy = parsedChanges.some((ch) => {
      if (
        (ch.kind === "change" || ch.kind === "remove") &&
        ch.target === "ingredient" &&
        isLegacyIngredientId(ch.refId)
      ) {
        return true;
      }
      if (ch.kind === "add" && ch.target === "step") {
        const payload = ch.payload as { ingredientIds?: string[] };
        if (payload.ingredientIds?.some(isLegacyIngredientId)) return true;
      }
      if (
        ch.kind === "change" &&
        ch.target === "step" &&
        ch.field === "ingredientIds" &&
        Array.isArray(ch.after)
      ) {
        if (
          (ch.after as unknown[]).some(
            (v) => typeof v === "string" && isLegacyIngredientId(v)
          )
        ) {
          return true;
        }
      }
      return false;
    });

    const legacyIdMap = new Map<string, string>();
    if (referencesLegacy) {
      const existing = await tx
        .select({ id: mealIngredients.id })
        .from(mealIngredients)
        .where(eq(mealIngredients.mealId, session.mealId))
        .limit(1);
      if (existing.length === 0) {
        const legacyArr = mealRow.ingredients ?? [];
        if (legacyArr.length > 0) {
          const inserted = await tx
            .insert(mealIngredients)
            .values(
              legacyArr.map((line, idx) => ({
                mealId: session.mealId,
                position: idx,
                name: line,
                quantityString: "",
                prepNote: null
              }))
            )
            .returning({
              id: mealIngredients.id,
              position: mealIngredients.position
            });
          for (const row of inserted) {
            legacyIdMap.set(
              `${LEGACY_INGREDIENT_PREFIX}${row.position}`,
              row.id
            );
          }
        }
      }
    }

    const remapId = (id: string): string => legacyIdMap.get(id) ?? id;

    for (const change of parsedChanges) {
      if (change.kind === "add") {
        if (change.target === "ingredient") {
          const payload = change.payload as {
            name?: string;
            quantityString?: string;
            prepNote?: string | null;
            position?: number;
          };
          // Default position = current max + 1.
          const [maxRow] = await tx
            .select({ p: max(mealIngredients.position) })
            .from(mealIngredients)
            .where(eq(mealIngredients.mealId, session.mealId));
          const nextPos =
            typeof payload.position === "number"
              ? payload.position
              : (maxRow?.p ?? -1) + 1;
          await tx.insert(mealIngredients).values({
            mealId: session.mealId,
            position: nextPos,
            name: payload.name ?? "Ingredient",
            quantityString: payload.quantityString ?? "",
            prepNote: payload.prepNote ?? null
          });
        } else if (change.target === "step") {
          const payload = change.payload as {
            title?: string;
            time?: string | null;
            body?: string;
            ingredientIds?: string[];
            position?: number;
          };
          const [maxRow] = await tx
            .select({ p: max(recipeSteps.position) })
            .from(recipeSteps)
            .where(eq(recipeSteps.mealId, session.mealId));
          const nextPos =
            typeof payload.position === "number"
              ? payload.position
              : (maxRow?.p ?? -1) + 1;
          await tx.insert(recipeSteps).values({
            mealId: session.mealId,
            position: nextPos,
            title: payload.title ?? "Step",
            time: payload.time ?? null,
            body: payload.body ?? "",
            ingredientIds: (payload.ingredientIds ?? []).map(remapId)
          });
        }
      } else if (change.kind === "change") {
        if (change.target === "ingredient") {
          const refId = remapId(change.refId);
          if (isLegacyIngredientId(refId)) {
            // Unmapped legacy ref — meal already had structured rows
            // when the materialisation guard ran, or the position
            // didn't exist. Skip rather than blow up the whole save.
            logger.warn("refine_skipped_unmapped_legacy_ref", {
              sessionId: session.id,
              refId: change.refId,
              field: change.field
            });
            continue;
          }
          const after = change.after;
          const update: Partial<typeof mealIngredients.$inferInsert> = {
            updatedAt: new Date()
          };
          switch (change.field) {
            case "name":
              if (typeof after === "string") update.name = after;
              break;
            case "quantityString":
              if (typeof after === "string") update.quantityString = after;
              break;
            case "prepNote":
              update.prepNote =
                typeof after === "string" ? after : null;
              break;
            case "position":
              if (typeof after === "number") update.position = after;
              break;
            default:
              // Unknown field — skip silently. Don't fail the whole save
              // because the AI invented a non-existent column.
              continue;
          }
          await tx
            .update(mealIngredients)
            .set(update)
            .where(
              and(
                eq(mealIngredients.id, refId),
                eq(mealIngredients.mealId, session.mealId)
              )
            );
        } else if (change.target === "step") {
          const after = change.after;
          const update: Partial<typeof recipeSteps.$inferInsert> = {
            updatedAt: new Date()
          };
          switch (change.field) {
            case "title":
              if (typeof after === "string") update.title = after;
              break;
            case "time":
              update.time = typeof after === "string" ? after : null;
              break;
            case "body":
              if (typeof after === "string") update.body = after;
              break;
            case "ingredientIds":
              if (Array.isArray(after)) {
                update.ingredientIds = (after as unknown[])
                  .filter((v): v is string => typeof v === "string")
                  .map(remapId);
              }
              break;
            case "position":
              if (typeof after === "number") update.position = after;
              break;
            default:
              continue;
          }
          await tx
            .update(recipeSteps)
            .set(update)
            .where(
              and(
                eq(recipeSteps.id, change.refId),
                eq(recipeSteps.mealId, session.mealId)
              )
            );
        } else if (change.target === "meta") {
          // Meta changes update the meal row directly. We only allow
          // a narrow allow-list of fields to avoid the AI clobbering
          // structural data like householdId.
          const after = change.after;
          const update: Partial<typeof meals.$inferInsert> = {
            updatedAt: new Date()
          };
          switch (change.field) {
            case "name":
              if (typeof after === "string") update.name = after;
              break;
            case "notes":
              update.notes = typeof after === "string" ? after : null;
              break;
            case "recipeText":
              update.recipeText = typeof after === "string" ? after : null;
              break;
            case "recipeSourceUrl":
              update.recipeSourceUrl =
                typeof after === "string" ? after : null;
              break;
            default:
              continue;
          }
          await tx
            .update(meals)
            .set(update)
            .where(eq(meals.id, session.mealId));
        }
      } else if (change.kind === "remove") {
        if (change.target === "ingredient") {
          const refId = remapId(change.refId);
          if (isLegacyIngredientId(refId)) {
            logger.warn("refine_skipped_unmapped_legacy_ref", {
              sessionId: session.id,
              refId: change.refId,
              kind: "remove"
            });
            continue;
          }
          await tx
            .delete(mealIngredients)
            .where(
              and(
                eq(mealIngredients.id, refId),
                eq(mealIngredients.mealId, session.mealId)
              )
            );
        } else if (change.target === "step") {
          await tx
            .delete(recipeSteps)
            .where(
              and(
                eq(recipeSteps.id, change.refId),
                eq(recipeSteps.mealId, session.mealId)
              )
            );
        }
      }
    }
    // Bump the meal's updatedAt + close the session.
    await tx
      .update(meals)
      .set({ updatedAt: new Date() })
      .where(eq(meals.id, session.mealId));
    await tx
      .update(refineSessions)
      .set({ status: SAVED_STATUS, savedAt: new Date() })
      .where(eq(refineSessions.id, session.id));
  });

  return { mealId: session.mealId, applied: pending.length };
}

// Drizzle import bookkeeping — `desc` is unused in this file but kept
// for parity with the meals service style. Drop in a future cleanup.
void desc;
