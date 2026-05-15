"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";

/**
 * Round 10 — back affordance on the recipe view. Phone-first UX: this is
 * the primary nav out of `/meal/[id]`, so the tap target gets full row
 * padding rather than a tiny icon-sized hitbox.
 *
 * Rendered as a real `<Link>` so SSR + right-click + open-in-new-tab all
 * behave. On left-click we hijack the navigation: if the browser has
 * intra-app history we pop it (`router.back()` keeps scroll restoration
 * and avoids a fresh server fetch); otherwise we fall through to the
 * Link's default navigation to `fallbackHref`. Keeping the URL on the
 * anchor (rather than guarding with state) avoids the
 * set-state-in-effect lint and gives screen readers the same visible
 * target regardless of history.
 */
export function MealBackLink({ fallbackHref }: { fallbackHref: Route }) {
  const router = useRouter();

  return (
    <Link
      href={fallbackHref}
      onClick={(event) => {
        // Honor cmd/ctrl/shift-click etc. — let the browser open a new
        // tab as the user expects, without back-popping the current one.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (event.button !== 0) return;
        if (typeof window === "undefined") return;
        // history.length > 1 means we have at least one prior entry in
        // this tab. Not a perfect signal — cross-origin referrers also
        // bump length — but `router.back()` is a no-op in that case,
        // and the Link's default navigation isn't worse than a no-op.
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </Link>
  );
}
