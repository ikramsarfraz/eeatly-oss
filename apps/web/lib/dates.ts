/**
 * Weekday + month + day for recipe cards, e.g. "Tue, Jun 3".
 *
 * Recipe cards (Home + Library, desktop + mobile-web) lead with the day a dish
 * was last cooked so the weekday is legible at a glance, not just the date.
 * Uses the runtime locale's short weekday/month via `toLocaleDateString`.
 */
export function formatCookedDay(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}
