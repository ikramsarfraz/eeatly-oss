/**
 * Shared attribution rules for meal-log cooked-by display.
 *
 *   - Returns null when the viewer cooked the meal (don't attribute to "you").
 *   - Returns the cook's name with the "by " prefix when another current
 *     household member cooked it.
 *   - Returns "by Former member" when the log exists but the cook's user
 *     row has been deleted — Round 4.7 migration 0017 changed
 *     meal_logs.cooked_by_user_id from CASCADE to SET NULL so logs survive
 *     the cook's account deletion; this is the visible signal that the
 *     log's attribution was lost on purpose, not a rendering bug.
 *
 * Kept in one place so the four meal-log renderers (dashboard recent,
 * history rows, history cards, history table) can't drift on these rules.
 */
export function attributionLabel(
  cookedByUserId: string | null,
  cookedByName: string | null,
  currentUserId: string
): string | null {
  // Viewer cooked it — silent.
  if (cookedByUserId === currentUserId) return null;

  // Cook still exists in the household; attribute by name.
  if (cookedByName) return `by ${cookedByName}`;

  // Cook's user row is gone (SET NULL from account delete) but the log
  // survived. Surface that explicitly so the household understands the
  // attribution lapse isn't a bug.
  if (cookedByUserId === null) return "by Former member";

  // We have an id but no name. In practice this is the optimistic-update
  // sentinel from `useCreateMealLog` (empty string id, empty string name);
  // the row gets replaced when the server response lands. Don't flash
  // "by Former member" in the meantime — stay silent.
  return null;
}
