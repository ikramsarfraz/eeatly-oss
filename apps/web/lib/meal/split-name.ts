/**
 * Round 27 — split a meal name into the editorial title pair the new
 * Recipe Detail hero uses.
 *
 * Visual contract:
 *   - Single-word names ("Biryani") → headline only, with a trailing
 *     period. ("Biryani.")
 *   - Multi-word names ("Chowmein Noodles") → an italic kicker for
 *     every word except the last, with a trailing comma, plus a
 *     headline for the last word with a trailing period.
 *     ("Chowmein," + "Noodles.")
 *
 * The trailing punctuation is part of the visual; the editorial
 * treatment leans on it for the typographic rhythm. Render the kicker
 * (when present) in italic display serif above the headline in roman
 * display serif.
 *
 * Edge cases:
 *   - Empty / whitespace-only input → `{ headline: "." }`. The hero
 *     band won't crash; the page-level fallback can decide whether to
 *     render anything meaningful instead.
 *   - Names with internal punctuation ("Pasta, alla vodka") still
 *     split on whitespace, so "alla vodka" survives as a 2-word kicker
 *     and "vodka" lands in the headline. Names with one trailing
 *     comma look natural in the kicker since the comma we append
 *     coexists with the existing one without visual noise.
 */
export function splitMealName(name: string): {
  kicker?: string;
  headline: string;
} {
  const trimmed = name.trim();
  if (!trimmed) return { headline: "." };
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return { headline: words[0] + "." };
  }
  return {
    kicker: words.slice(0, -1).join(" ") + ",",
    headline: words[words.length - 1] + "."
  };
}
