"use client";

import * as React from "react";
import { detectPlatform } from "@eeatly/shared";
import { UrlPreviewCard } from "./url-preview-card";

/**
 * Inline preview shown next to the meal log form's `recipeSourceUrl`
 * input as the user pastes. We *don't* render the full
 * YouTube/TikTok/Pinterest embed here — those are expensive to mount
 * (third-party scripts, iframes), and the user hasn't saved the meal
 * yet. A small platform badge is enough.
 *
 * For generic web URLs, we DO fetch the OG card — most users won't
 * recognize a blog hostname at a glance, and the image + title
 * confirms they pasted the right URL.
 *
 * Debounced 400ms so each keystroke during a paste-and-type session
 * doesn't trigger a fetch.
 */
type Props = {
  url: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube video",
  tiktok: "TikTok video",
  pinterest: "Pinterest pin",
  instagram: "Instagram post"
};

export function SourceUrlInputPreview({ url }: Props) {
  const trimmed = url.trim();
  const debouncedUrl = useDebouncedValue(trimmed, 400);

  if (!debouncedUrl) return null;

  const detected = detectPlatform(debouncedUrl);
  if (!detected) {
    return (
      <p className="text-[11px] text-muted-foreground">
        We&apos;ll save this URL even if it isn&apos;t a recognised platform.
      </p>
    );
  }

  if (detected.platform === "web" || detected.platform === "instagram") {
    return <UrlPreviewCard url={detected.canonicalUrl} />;
  }

  return (
    <p className="text-[11px] text-muted-foreground">
      Recognised as a{" "}
      <span className="font-medium text-foreground">
        {PLATFORM_LABEL[detected.platform]}
      </span>
      . We&apos;ll embed it on the recipe page.
    </p>
  );
}

/**
 * Debounce a fast-changing value — typing in the URL input fires
 * react-hook-form watchers on every keystroke, but we only want to
 * fetch the OG preview after the user pauses. The effect schedules a
 * single setState; we read the latest value via cleanup, so React's
 * "no setState in effect body" rule is preserved (the setState lives
 * inside the timeout callback, not the effect body).
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
