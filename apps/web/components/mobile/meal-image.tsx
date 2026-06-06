"use client";

import * as React from "react";
import { MealTile, type MealTileSize } from "@/components/ui/meal-tile";
import { cn } from "@/lib/utils";

const MAX_IMG_RETRIES = 4;

/**
 * R36 — mobile recipe thumbnail. Renders the meal's photo (own manual photo or
 * the app-wide AI dish image, already coalesced server-side into `photoUrl`)
 * when present, falling back to the monogram `MealTile` otherwise.
 *
 * Read-after-write resilient, like the desktop hero: a just-generated R2 object
 * can briefly 404 on its first GET (edge lag), so on error we retry the same
 * URL a few times with a short backoff + a cache-busting param before giving up
 * and showing the tile. State resets when `photoUrl` changes (the component is
 * effectively keyed on it via the retry reset below).
 */
export function MealImage({
  name,
  photoUrl,
  size = "m",
  className
}: {
  name: string;
  photoUrl: string | null | undefined;
  size?: MealTileSize;
  className?: string;
}) {
  const [retry, setRetry] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  // Reset retry/failed state when the source changes (render-time, so a new
  // photo gets a fresh set of attempts without an effect).
  const [lastSrc, setLastSrc] = React.useState(photoUrl ?? null);
  if ((photoUrl ?? null) !== lastSrc) {
    setLastSrc(photoUrl ?? null);
    setRetry(0);
    setFailed(false);
  }

  function handleError() {
    if (retry >= MAX_IMG_RETRIES) {
      setFailed(true);
      return;
    }
    const next = retry + 1;
    // Back off (~0.6s, 1.2s, 1.8s, 2.4s) so the edge has time to catch up.
    window.setTimeout(() => setRetry(next), 600 * next);
  }

  if (photoUrl && !failed) {
    // Append the retry counter so the browser refetches instead of reusing a
    // cached miss; r2.dev ignores the extra query param.
    const src = retry > 0 ? `${photoUrl}${photoUrl.includes("?") ? "&" : "?"}r=${retry}` : photoUrl;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={handleError}
        className={cn("object-cover", className)}
      />
    );
  }
  return <MealTile name={name} size={size} className={className} />;
}
