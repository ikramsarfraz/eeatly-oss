/**
 * Round 13 — tiny date helpers for mobile screens. Inline rather than
 * pulling date-fns onto mobile; the surface here is small and Phase-2
 * tile copy doesn't need anything more sophisticated.
 *
 * Inputs are always ISO date strings (`yyyy-MM-dd` or full timestamps)
 * because every tRPC procedure returns them that way through
 * superjson — sometimes as `Date`, sometimes as the string the
 * service emitted. Both forms are accepted.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Cooked-on phrasing for tiles + recipe view meta rows:
 *   - today
 *   - yesterday
 *   - 4 days ago
 *   - May 2 (current year)
 *   - May 2, 2024 (older years)
 */
export function formatCookedAt(value: string | Date | null): string {
  if (!value) return "never cooked";
  const date = toDate(value);
  const now = new Date();
  const daysAgo = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      MS_PER_DAY
  );
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  const sameYear = date.getFullYear() === now.getFullYear();
  const month = date.toLocaleString("en-US", { month: "short" });
  return sameYear
    ? `${month} ${date.getDate()}`
    : `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Friendly cook-count phrasing for tiles:
 *   - "1 time", "2 times", … "10+ times"
 * Capped at "10+" so really-frequent meals don't blow out the tile
 * width on small screens.
 */
export function formatCookCount(n: number): string {
  if (n <= 0) return "not yet cooked";
  if (n === 1) return "1 time";
  if (n > 10) return "10+ times";
  return `${n} times`;
}
