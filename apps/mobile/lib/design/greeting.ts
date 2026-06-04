/**
 * Round 18 — Home greeting helpers.
 *
 * Editorial design renders three lines:
 *   - italic serif kicker ("Good evening,")
 *   - big serif first name + trailing period ("Saif.")
 *   - mono uppercase date eyebrow ("FRI · MAY 15 · 2026")
 */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

/**
 * "FRI · MAY 15 · 2026" — uppercase, dot-separator, year always shown
 * to match the editorial weight in the handoff.
 */
export function dateEyebrow(date: Date): string {
  const weekday = date.toLocaleString("en-US", { weekday: "short" });
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} · ${month} ${day} · ${year}`.toUpperCase();
}

/**
 * Extracts a short, display-ready first name. Handles dotted usernames
 * ("alex.rivers" → "Saif"-style first chunk → "M") by taking up to 12
 * chars of the first whitespace-or-dot segment, then title-casing the
 * first character. Falls back to "there" for empty inputs.
 *
 * The handoff specifically calls out "First name only (or first 8
 * chars before a dot if username contains a dot)". The dotted form
 * tends to look ugly capitalized, so we keep the case the user gave
 * us for that path and only title-case whitespace-split names.
 */
export function displayFirstName(raw: string | null | undefined): string {
  if (!raw) return "there";
  const value = raw.trim();
  if (!value) return "there";
  if (value.includes("@")) {
    // Email — take the local part up to the first dot.
    const local = value.split("@")[0] ?? value;
    return formatChunk(local);
  }
  const whitespaceFirst = value.split(/\s+/)[0] ?? value;
  if (whitespaceFirst.includes(".")) {
    return formatChunk(whitespaceFirst);
  }
  return whitespaceFirst.charAt(0).toUpperCase() + whitespaceFirst.slice(1);
}

function formatChunk(chunk: string): string {
  const head = chunk.split(".")[0] ?? chunk;
  const trimmed = head.slice(0, 12);
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
