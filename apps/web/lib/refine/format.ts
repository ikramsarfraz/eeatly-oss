import type { PendingChange } from "@eeatly/api/validators/refine";

/**
 * Round 22 — web port of apps/mobile/lib/refine-format.ts (verbatim,
 * minus the Round/source-comment header). Wire → display helpers for
 * the Refine + Review screens.
 *
 * `PendingChange` (R18 validator) is the wire shape — discriminated
 * union with `add | change | remove`. Both surfaces need a short
 * row title, a mono caps eyebrow ("INGREDIENT · ROW 1"), and the
 * before/after lines for the diff. Two copies for now (one on each
 * client); consolidate into `packages/shared` later if drift becomes
 * a problem.
 */

export type RecipeRow = {
  id: string;
  position: number;
  name: string;
  quantityString?: string;
  prepNote?: string | null;
};

export type RecipeStepRow = {
  id: string;
  position: number;
  title: string;
  time?: string | null;
  body: string;
};

export type ResolverContext = {
  ingredients: RecipeRow[];
  steps: RecipeStepRow[];
};

export function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => formatScalar(v))
      .join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function findIngredient(ctx: ResolverContext, refId: string): RecipeRow | null {
  return ctx.ingredients.find((row) => row.id === refId) ?? null;
}

function findStep(ctx: ResolverContext, refId: string): RecipeStepRow | null {
  return ctx.steps.find((row) => row.id === refId) ?? null;
}

function titleCaseField(field: string): string {
  const map: Record<string, string> = {
    name: "name",
    quantityString: "quantity",
    prepNote: "prep note",
    position: "position",
    title: "title",
    time: "time",
    body: "body",
    ingredientIds: "linked ingredients",
    notes: "notes",
    recipeText: "recipe text",
    recipeSourceUrl: "source URL"
  };
  return map[field] ?? field;
}

export type DisplayChange = {
  title: string;
  typeLabel: string;
  verb: "Added" | "Changed" | "Removed";
  before: string | null;
  after: string | null;
};

export function describePendingChange(
  change: PendingChange,
  ctx: ResolverContext
): DisplayChange {
  if (change.kind === "add") {
    return describeAdd(change, ctx);
  }
  if (change.kind === "change") {
    return describeChange(change, ctx);
  }
  return describeRemove(change, ctx);
}

function describeAdd(
  change: Extract<PendingChange, { kind: "add" }>,
  ctx: ResolverContext
): DisplayChange {
  const where = change.whereHint ? ` · ${change.whereHint}` : "";
  if (change.target === "ingredient") {
    const p = change.payload as {
      name?: string;
      quantityString?: string;
      prepNote?: string | null;
    };
    const name = p.name ?? "Ingredient";
    const qty = p.quantityString ?? "";
    const prep = p.prepNote ?? "";
    const afterParts = [qty, prep].filter((s) => s && s.length > 0);
    return {
      title: qty ? `${name} · ${qty}` : name,
      typeLabel: `ADDED · INGREDIENT${where ? where.toUpperCase() : ""}`,
      verb: "Added",
      before: null,
      after: afterParts.length > 0 ? afterParts.join(" · ") : name
    };
  }
  if (change.target === "step") {
    const p = change.payload as {
      title?: string;
      body?: string;
      time?: string | null;
      position?: number;
    };
    const stepLabel =
      typeof p.position === "number"
        ? `Step ${p.position + 1}`
        : ctx.steps.length > 0
          ? `Step ${ctx.steps.length + 1}`
          : "New step";
    const title = p.title ? `${stepLabel} · ${p.title}` : stepLabel;
    return {
      title,
      typeLabel: `ADDED · STEP${where ? where.toUpperCase() : ""}`,
      verb: "Added",
      before: null,
      after: p.body ?? p.title ?? "New step"
    };
  }
  return {
    title: "New metadata",
    typeLabel: `ADDED · META${where ? where.toUpperCase() : ""}`,
    verb: "Added",
    before: null,
    after: formatScalar(change.payload)
  };
}

function describeChange(
  change: Extract<PendingChange, { kind: "change" }>,
  ctx: ResolverContext
): DisplayChange {
  if (change.target === "ingredient") {
    const row = findIngredient(ctx, change.refId);
    const name = row?.name ?? "Ingredient";
    const rowLabel = row
      ? `ROW ${row.position + 1}`
      : `ROW ${shortRefId(change.refId)}`;
    return {
      title: `${name} · ${titleCaseField(change.field)}`,
      typeLabel: `CHANGED · INGREDIENT · ${rowLabel}`,
      verb: "Changed",
      before: formatScalar(change.before),
      after: formatScalar(change.after)
    };
  }
  if (change.target === "step") {
    const row = findStep(ctx, change.refId);
    const stepLabel = row
      ? `STEP ${row.position + 1}`
      : `STEP ${shortRefId(change.refId)}`;
    const stepTitle = row?.title ?? "Step";
    return {
      title: `${stepTitle} · ${titleCaseField(change.field)}`,
      typeLabel: `CHANGED · ${stepLabel}`,
      verb: "Changed",
      before: formatScalar(change.before),
      after: formatScalar(change.after)
    };
  }
  return {
    title: titleCaseField(change.field),
    typeLabel: `CHANGED · META · ${change.field.toUpperCase()}`,
    verb: "Changed",
    before: formatScalar(change.before),
    after: formatScalar(change.after)
  };
}

function describeRemove(
  change: Extract<PendingChange, { kind: "remove" }>,
  ctx: ResolverContext
): DisplayChange {
  if (change.target === "ingredient") {
    const row = findIngredient(ctx, change.refId);
    const name = row?.name ?? formatScalar(change.before) ?? "Ingredient";
    const rowLabel = row
      ? `ROW ${row.position + 1}`
      : `ROW ${shortRefId(change.refId)}`;
    return {
      title: name,
      typeLabel: `REMOVED · INGREDIENT · ${rowLabel}`,
      verb: "Removed",
      before: row
        ? [row.quantityString, row.prepNote ?? null]
            .filter((s): s is string => Boolean(s))
            .join(" · ") || name
        : formatScalar(change.before),
      after: null
    };
  }
  if (change.target === "step") {
    const row = findStep(ctx, change.refId);
    const stepLabel = row
      ? `STEP ${row.position + 1}`
      : `STEP ${shortRefId(change.refId)}`;
    return {
      title: row?.title ?? "Step",
      typeLabel: `REMOVED · ${stepLabel}`,
      verb: "Removed",
      before: row?.body ?? formatScalar(change.before),
      after: null
    };
  }
  return {
    title: "Removed metadata",
    typeLabel: "REMOVED · META",
    verb: "Removed",
    before: formatScalar(change.before),
    after: null
  };
}

function shortRefId(refId: string): string {
  const legacy = refId.match(/^legacy-(?:ingredient|step)-(\d+)$/);
  if (legacy) return String(Number(legacy[1]) + 1);
  return refId.slice(-4).toUpperCase();
}

export function summariseCounts(changes: PendingChange[]): {
  add: number;
  change: number;
  remove: number;
  total: number;
} {
  let add = 0;
  let change = 0;
  let remove = 0;
  for (const p of changes) {
    if (p.kind === "add") add += 1;
    else if (p.kind === "change") change += 1;
    else remove += 1;
  }
  return { add, change, remove, total: add + change + remove };
}
