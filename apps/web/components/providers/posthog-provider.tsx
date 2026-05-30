"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { authClient } from "@/lib/auth/client";

/**
 * PostHog client analytics — tracks visits (pageviews / unique visitors)
 * and new users (person profiles created on identify after auth).
 *
 * Inert without `NEXT_PUBLIC_POSTHOG_KEY`: the SDK never initializes, so
 * local/dev/preview ship no analytics behaviour and need no env vars.
 *
 * Events ride through the `/ingest` reverse proxy (next.config rewrites)
 * so ad-blockers can't undercount. Pageviews are captured manually
 * because the App Router does client-side navigation that posthog-js's
 * automatic `$pageview` doesn't see.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let initialized = false;

function ensureInit() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
    // We capture pageviews ourselves on route change (see PageView below).
    capture_pageview: false,
    capture_pageleave: true,
    // Only build person profiles for identified (signed-in) users; anon
    // visits are still counted for traffic, but we don't pay for a person
    // record per anonymous visitor.
    person_profiles: "identified_only"
  });
  initialized = true;
}

/**
 * Capture a custom PostHog event from anywhere on the client. No-op when
 * PostHog isn't configured (or on the server), so callers don't need to
 * guard the key themselves. Use for funnel events like `signed_up`.
 */
export function capturePostHogEvent(
  name: string,
  properties?: Record<string, unknown>
) {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  posthog.capture(name, properties);
}

/** Fires a `$pageview` on every App Router navigation. */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!POSTHOG_KEY || !pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/** Ties the current signed-in user to their PostHog person on login. */
function PostHogIdentify() {
  const { data } = authClient.useSession();
  const userId = data?.user?.id;
  const email = data?.user?.email;

  React.useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (userId) {
      posthog.identify(userId, email ? { email } : undefined);
    }
  }, [userId, email]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    ensureInit();
  }, []);

  return (
    <>
      {/* useSearchParams must sit under a Suspense boundary so it doesn't
          force the whole tree into client-side bailout at build time. */}
      <React.Suspense fallback={null}>
        <PostHogPageView />
      </React.Suspense>
      <PostHogIdentify />
      {children}
    </>
  );
}
