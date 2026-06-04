import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Round 12: `normalizeMealName` moved to `@eeatly/shared` so the rule
// is defined in one place that both web and mobile can import. Re-
// exported here to preserve the existing `@/lib/utils` import surface.
export { normalizeMealName } from "@eeatly/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * UUID v4 that also works in NON-secure browser contexts. `crypto.randomUUID`
 * is secure-context-only (HTTPS or localhost), so it's `undefined` on plain
 * HTTP custom hosts like `http://localtest.me` — calling it there throws. This
 * prefers it when available, falls back to `crypto.getRandomValues` (which
 * works in insecure contexts), then to `Math.random` as a last resort. Fine
 * for client-side ids (toasts, device ids); not for security tokens.
 */
export function randomUuid(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function formatDaysAgo(days: number) {
  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "1 day ago";
  }

  return `${days} days ago`;
}
