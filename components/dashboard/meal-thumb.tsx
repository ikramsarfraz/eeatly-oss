import { cn } from "@/lib/utils";

const gradients = [
  "bg-gradient-to-br from-[#d3c0a8] to-[#a8946d]",
  "bg-gradient-to-br from-[#b6cbb3] to-[#6b8869]",
  "bg-gradient-to-br from-[#e8c5a8] to-[#c47a4a]",
  "bg-gradient-to-br from-[#d4c9b0] to-[#8c7a4d]",
  "bg-gradient-to-br from-[#cdd8c8] to-[#7a9272]",
  "bg-gradient-to-br from-[#f0d4ba] to-[#d28a52]"
];

type MealThumbProps = {
  photoUrl?: string | null;
  mealName: string;
  /** Index used to pick a deterministic gradient when no photo is set. */
  fallbackIndex?: number;
  className?: string;
};

/**
 * Renders the meal photo when present, otherwise a deterministic gradient
 * fallback. Closes the previously-half-implemented photo feature: photos
 * were uploaded and persisted, but no view rendered them.
 *
 * Uses a plain <img> intentionally — the project's policy is to skip
 * next/image to avoid Vercel's Image Optimization billing. Photos are
 * served straight from R2's public CDN with `loading="lazy"` for laziness
 * and `object-cover` for sizing. Don't migrate to next/image without an
 * explicit decision.
 */
export function MealThumb({
  photoUrl,
  mealName,
  fallbackIndex = 0,
  className
}: MealThumbProps) {
  const sizeClass = "h-11 w-11 shrink-0 rounded-[9px]";

  if (photoUrl) {
    // R2 public host not yet allowlisted in next.config remotePatterns; using
    // <img> keeps photo rendering working without that wiring. Switch to
    // <Image> once R2_PUBLIC_BASE_URL is registered.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={mealName ? `${mealName} photo` : "Meal photo"}
        loading="lazy"
        decoding="async"
        className={cn(sizeClass, "object-cover bg-[var(--surface-2)]", className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(sizeClass, gradients[fallbackIndex % gradients.length], className)}
    />
  );
}
