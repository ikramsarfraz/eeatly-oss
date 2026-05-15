import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Round 12: `normalizeMealName` moved to `@eeatly/shared` so the rule
// is defined in one place that both web and mobile can import. Re-
// exported here to preserve the existing `@/lib/utils` import surface.
export { normalizeMealName } from "@eeatly/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
