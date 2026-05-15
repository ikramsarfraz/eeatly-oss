/**
 * Round 12 — pure string utilities used by both web and (eventually)
 * mobile. Co-located here so the normalization rule is defined in
 * exactly one place: a meal name typed on mobile produces the same
 * `normalizedName` the unique index in Postgres enforces.
 *
 * Keep this file deps-free. No React, no Next, no DB.
 */

/**
 * Canonicalize a meal name for the `meals.normalized_name` unique
 * index. Lowercases, trims, collapses runs of whitespace. Must stay
 * in lockstep with the DB's expectation; changing the rule means
 * either re-normalizing every row in `meals` or accepting drift.
 */
export function normalizeMealName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
