import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeMealName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
