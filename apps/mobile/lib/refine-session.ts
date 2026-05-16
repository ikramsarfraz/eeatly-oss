import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Round 20 — refine-session state.
 *
 * A refine session is a per-device draft layered on top of a recipe.
 * The user submits prompts (text / voice / photo); each prompt becomes
 * a `RefineTurn` recording what the AI proposed. All proposed changes
 * flatten into `pending`, which is what the Review screen renders and
 * what eventually persists when the user saves.
 *
 * The store is module-scoped (one session per `recipeId`) so the
 * Refine and Review routes — which mount in separate component trees —
 * stay in sync without a Context provider. State lives in memory only;
 * a hot reload or app-kill wipes it, which matches the spec ("local
 * until Save"). When the backend `meals.applyRefinements` mutation
 * lands, `applyPending` will swap from a no-op to a real call.
 *
 * Important: nothing in this module persists to the server. Save is
 * still a UI no-op (returns success after a short delay) so the demo
 * flow round-trips through Refine → Review → Recipe Detail.
 */

export type RefineSource = "text" | "voice" | "photo";

export type PendingChange =
  | {
      id: string;
      kind: "add";
      target: "ingredient" | "step";
      label: string;
      /** Mono-rendered "after" line ("1 tbsp · added to step 1"). */
      after: string;
      /** Mono-rendered "where" eyebrow ("Ingredient · row 19"). */
      where: string;
    }
  | {
      id: string;
      kind: "change";
      target: "ingredient" | "step" | "meta";
      label: string;
      before: string;
      after: string;
      where: string;
    }
  | {
      id: string;
      kind: "remove";
      target: "ingredient" | "step";
      label: string;
      before: string;
      where: string;
    };

export type RefineTurn = {
  id: string;
  source: RefineSource;
  /** What the user said / typed / captioned. */
  prompt: string;
  /** What the AI proposed for this turn. Flattens into the session
   *  pending list. */
  proposed: PendingChange[];
  createdAt: number;
};

export type RefineSession = {
  recipeId: string;
  turns: RefineTurn[];
  pending: PendingChange[];
  /** True when the placeholder demo turns are still in place — used by
   *  the UI to render a hint that this is mock data. The flag flips to
   *  `false` as soon as the user submits a real prompt. */
  isPlaceholder: boolean;
};

const sessions = new Map<string, RefineSession>();
const listeners = new Map<string, Set<() => void>>();

function emit(recipeId: string) {
  const set = listeners.get(recipeId);
  if (!set) return;
  for (const l of set) l();
}

function ensure(recipeId: string): RefineSession {
  const existing = sessions.get(recipeId);
  if (existing) return existing;
  const seeded = seedPlaceholder(recipeId);
  sessions.set(recipeId, seeded);
  return seeded;
}

/**
 * Two placeholder turns mirroring the handoff mock. They demonstrate the
 * chat-style history + DiffRow rendering without requiring a live AI
 * backend. Will be replaced by real `ai.refineRecipe` results once the
 * backend procedure lands.
 */
function seedPlaceholder(recipeId: string): RefineSession {
  const now = Date.now();
  const turns: RefineTurn[] = [
    {
      id: "placeholder-1",
      source: "voice",
      prompt:
        "Add a sixth step — garnish with chopped cilantro and a wedge of lime.",
      createdAt: now - 60_000,
      proposed: [
        {
          id: "placeholder-1-add-step",
          kind: "add",
          target: "step",
          label: "Step 6 · Garnish & serve",
          after: "Finish with chopped cilantro and a wedge of lime.",
          where: "Step 6 · new step"
        }
      ]
    },
    {
      id: "placeholder-2",
      source: "text",
      prompt: "Bump the chicken to 600 g and add 1 tbsp ginger paste.",
      createdAt: now - 30_000,
      proposed: [
        {
          id: "placeholder-2-chicken",
          kind: "change",
          target: "ingredient",
          label: "Chicken · 400 g → 600 g",
          before: "400 g · boneless, sliced",
          after: "600 g · boneless, sliced",
          where: "Ingredient · row 1"
        },
        {
          id: "placeholder-2-ginger",
          kind: "add",
          target: "ingredient",
          label: "Ginger paste · 1 tbsp",
          after: "1 tbsp · added to step 1",
          where: "Ingredient · row 19"
        },
        {
          id: "placeholder-2-step",
          kind: "change",
          target: "step",
          label: "Step 1 · marinade copy refreshed",
          before:
            "Combine the chicken with salt, both peppers, garlic, onion, paprika and cumin.",
          after:
            "Combine the chicken with salt, peppers, garlic, onion, ginger paste, paprika and cumin.",
          where: "Step 1 · Marinate the chicken"
        }
      ]
    }
  ];
  return {
    recipeId,
    turns,
    pending: turns.flatMap((t) => t.proposed),
    isPlaceholder: true
  };
}

export function useRefineSession(recipeId: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(recipeId);
      if (!set) {
        set = new Set();
        listeners.set(recipeId, set);
      }
      set.add(cb);
      return () => {
        set!.delete(cb);
      };
    },
    [recipeId]
  );

  const getSnapshot = useCallback(() => ensure(recipeId), [recipeId]);

  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const submitText = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      const current = ensure(recipeId);
      // First real submission clears the placeholder demo turns so the
      // session reads like fresh activity rather than canned data.
      const baseTurns = current.isPlaceholder ? [] : current.turns;
      const basePending = current.isPlaceholder ? [] : current.pending;
      const newTurn: RefineTurn = {
        id: `text-${Date.now()}`,
        source: "text",
        prompt: trimmed,
        createdAt: Date.now(),
        proposed: [
          // Placeholder until the AI procedure lands — submit echoes
          // the prompt as a single proposed "change · meta" pill so
          // the chat history actually grows when the user types.
          {
            id: `text-${Date.now()}-echo`,
            kind: "change",
            target: "meta",
            label: "Prompt received",
            before: "(waiting on AI wiring)",
            after: trimmed,
            where: "Refine session"
          }
        ]
      };
      sessions.set(recipeId, {
        recipeId,
        isPlaceholder: false,
        turns: [...baseTurns, newTurn],
        pending: [...basePending, ...newTurn.proposed]
      });
      emit(recipeId);
    },
    [recipeId]
  );

  const clear = useCallback(() => {
    sessions.set(recipeId, {
      recipeId,
      turns: [],
      pending: [],
      isPlaceholder: false
    });
    emit(recipeId);
  }, [recipeId]);

  /**
   * Final-save sink. No-op for now — clears the session and returns
   * success so the Review screen can confirm and pop back. Replace
   * with a tRPC mutation once the backend procedure exists.
   */
  const applyPending = useCallback(async (): Promise<void> => {
    // TODO(round-20+): wire to `meals.applyRefinements` mutation.
    await new Promise((resolve) => setTimeout(resolve, 200));
    sessions.set(recipeId, {
      recipeId,
      turns: [],
      pending: [],
      isPlaceholder: false
    });
    emit(recipeId);
  }, [recipeId]);

  const counts = useMemo(() => countChanges(session.pending), [session.pending]);

  return { session, submitText, clear, applyPending, counts };
}

export function countChanges(pending: PendingChange[]): {
  add: number;
  change: number;
  remove: number;
  total: number;
} {
  let add = 0;
  let change = 0;
  let remove = 0;
  for (const p of pending) {
    if (p.kind === "add") add += 1;
    else if (p.kind === "change") change += 1;
    else remove += 1;
  }
  return { add, change, remove, total: add + change + remove };
}
