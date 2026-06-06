"use client";

import * as React from "react";
import { MealTile, type MealTileSize } from "@/components/ui/meal-tile";
import { cn } from "@/lib/utils";

/**
 * R36 — mobile recipe thumbnail. Renders the meal's photo (own manual photo or
 * the app-wide AI dish image, already coalesced server-side into `photoUrl`)
 * when present, falling back to the monogram `MealTile` otherwise. A just-
 * generated R2 object can briefly 404 on its first GET (edge lag), so an
 * `onError` flips to the tile rather than leaving a broken image. Mirrors the
 * desktop `<img> ?? <MealTile>` pattern used in the Library/Recipe views.
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
  const [failed, setFailed] = React.useState(false);

  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("object-cover", className)}
      />
    );
  }
  return <MealTile name={name} size={size} className={className} />;
}
