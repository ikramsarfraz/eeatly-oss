"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useToast } from "@/components/providers/toast-provider";

/**
 * Round 9 — fires a welcome toast when the user lands on the dashboard
 * from the onboarding flow. Two flavors, keyed on `?welcome=`:
 *
 *   - `?welcome=fresh` — solo signup just finished. Soft suggestion to
 *     invite family from Settings.
 *   - `?welcome=invited&kitchen=<name>` — accepted an invitation. Names
 *     the kitchen so the moment feels personal.
 *
 * After firing, the query params are stripped via `router.replace` so a
 * page reload doesn't re-fire the toast and the URL stays clean for
 * subsequent visits.
 */
export function WelcomeToast() {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Track whether we've already fired in this mount — guards against the
  // showToast effect re-running if a parent re-renders (showToast is
  // stable but we belt-and-brace it).
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (firedRef.current) return;
    const welcome = searchParams.get("welcome");
    if (welcome !== "fresh" && welcome !== "invited") return;

    if (welcome === "fresh") {
      showToast({
        variant: "success",
        title: "You're all set",
        description:
          "Log a meal whenever you cook. Invite family from Settings when you're ready."
      });
    } else {
      const kitchen = searchParams.get("kitchen")?.trim();
      showToast({
        variant: "success",
        title: kitchen ? `Welcome to ${kitchen}` : "Welcome",
        description:
          "Here's what your family has been cooking. Your meals show up here too."
      });
    }
    firedRef.current = true;

    // Strip the welcome params so a refresh doesn't re-fire the toast.
    // Preserve any other params the dashboard may use later. The cast
    // to `Route` is required because Next 16's typed-routes statically
    // checks router.replace's argument; the URL we construct here is
    // an internal app path so the cast is safe.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("welcome");
    params.delete("kitchen");
    const cleanQuery = params.toString();
    router.replace(
      `${pathname}${cleanQuery ? `?${cleanQuery}` : ""}` as Route
    );
  }, [pathname, router, searchParams, showToast]);

  return null;
}
