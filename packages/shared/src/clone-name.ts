/**
 * Pre-fill the new plan's name when cloning from a past one. The win
 * case: "Eid al-Adha 2024" → "Eid al-Adha 2025" so the user doesn't
 * have to retype the whole title. Fall back to "<name> (copy)" when no
 * year is detected — keep the original visible so the user can edit
 * in place.
 *
 * Heuristic: find the LAST 4-digit number in the name that looks like
 * a year (1900–2099). Bump by 1. Anchoring on the last match handles
 * names like "1971 Mom's Eid 2024" without producing "1972 Mom's Eid
 * 2024" (which is almost never what the user wanted).
 *
 * Round 15.5 Task 5 — promoted to `packages/shared` so the mobile
 * clone-plan sheet can drop its inlined copy and both clients pull
 * from one source of truth.
 */
const YEAR_REGEX = /\b(19\d{2}|20\d{2})\b/g;

export function bumpYearInName(name: string): string {
  const matches = Array.from(name.matchAll(YEAR_REGEX));
  if (matches.length === 0) {
    return `${name} (copy)`;
  }
  const last = matches[matches.length - 1]!;
  const year = Number(last[0]);
  const start = last.index ?? 0;
  const end = start + last[0].length;
  return `${name.slice(0, start)}${year + 1}${name.slice(end)}`;
}
