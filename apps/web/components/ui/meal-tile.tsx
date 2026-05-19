import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Round 25 — web port of the mobile `MealTile` primitive
 * (`apps/mobile/components/ui/meal-tile.tsx`). The signature visual
 * element: a typographic monogram tile rendered when a meal has no
 * photo, with the dish's first letter set in Instrument Serif italic
 * over a hashed-palette background and a faint dotted texture.
 *
 * The hash function is ported verbatim from mobile
 * (`apps/mobile/lib/design/tokens.ts`'s `mealHash`) so the same dish
 * deterministically resolves to the same palette across both clients.
 * That cross-platform stability is what makes the app feel like it
 * remembers cooking, not just stores strings.
 *
 * Palettes are hex-coded here rather than read from CSS variables.
 * The mobile palette tokens (sage / terracotta / wheat / mint / rose /
 * indigo) don't all have web semantic-token siblings — the closest
 * matches (`--sage`, `--wheat`, `--terra`) cover only three of the six
 * tones, and re-using them would collapse 6 hash buckets into 3 and
 * lose the deterministic-per-dish guarantee. Dark-mode palette siblings
 * are picked in the same hue families.
 *
 * Photo override: callers pass `photoUrl` to render the photo instead
 * of the monogram. The page composes this with an `<img>` at the same
 * aspect ratio (4:3 on web — wider than mobile's square because web
 * lays out horizontally), so this component renders only the empty
 * state. That keeps the prop surface narrow and avoids dragging a
 * Next.js `<Image>` decision into a generic primitive.
 */

type MealTilePalette = {
  bg: string;
  fg: string;
  dot: string;
  /** Dark-mode siblings — picked in the same hue family, retuned for
   *  the warm near-black ground. */
  bgDark: string;
  fgDark: string;
  dotDark: string;
};

const MEAL_TILE_PALETTES: ReadonlyArray<MealTilePalette> = [
  // sage
  { bg: "#D7DEC8", fg: "#2E5739", dot: "#A8B79A", bgDark: "#2A3022", fgDark: "#A1CBA9", dotDark: "#4A5640" },
  // terracotta
  { bg: "#E9D6C2", fg: "#7C3F1F", dot: "#D2A984", bgDark: "#3A2A20", fgDark: "#D88865", dotDark: "#5C4030" },
  // wheat
  { bg: "#E2DDC4", fg: "#665225", dot: "#C8B98B", bgDark: "#3A2F18", fgDark: "#C9B176", dotDark: "#5A4824" },
  // mint
  { bg: "#CBD9CF", fg: "#2E4F45", dot: "#9DB1A6", bgDark: "#1F2E27", fgDark: "#8FB3A4", dotDark: "#3F5A4E" },
  // rose
  { bg: "#E5D2CE", fg: "#7A3D3D", dot: "#C9A8A4", bgDark: "#3A2828", fgDark: "#D08484", dotDark: "#5C4040" },
  // indigo
  { bg: "#D4D7E0", fg: "#3A4566", dot: "#A9AEC0", bgDark: "#26283A", fgDark: "#8E96B7", dotDark: "#454A66" }
];

/**
 * Hash a meal name to a 32-bit integer. Ported byte-for-byte from
 * `apps/mobile/lib/design/tokens.ts:mealHash` so web and mobile bucket
 * the same dish identically. `| 0` coerces to a 32-bit int (matches
 * the mobile arithmetic).
 */
export function mealHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function mealPalette(name: string): MealTilePalette {
  return MEAL_TILE_PALETTES[mealHash(name) % MEAL_TILE_PALETTES.length];
}

type MealTileSize = "s" | "m" | "l";

const TILE_LETTER_SIZE: Record<MealTileSize, string> = {
  // Tuned for web reading distance — `l` reads as a hero monogram
  // anchoring the sidebar; `m` fills a 44px row thumbnail with the
  // glyph dominant; `s` is for inline contexts.
  s: "text-[28px] sm:text-[32px]",
  m: "text-[56px] sm:text-[64px]",
  l: "text-[112px] sm:text-[128px]"
};

const TILE_RADIUS: Record<MealTileSize, string> = {
  s: "rounded-md",
  m: "rounded-lg",
  l: "rounded-xl"
};

export function MealTile({
  name,
  size = "m",
  className,
  isPersonal
}: {
  name: string;
  size?: MealTileSize;
  className?: string;
  /**
   * Round 32 — when true, a small lock icon renders in the top-right
   * corner to signal "personal — only the creator sees this meal."
   * The prop is intentionally undefined-able rather than defaulting
   * to false so caller pages can pass `isPersonal={isMultiMember &&
   * meal.sharedAt === null}` without further branching: undefined
   * skips the icon entirely. Single-member households never set it,
   * so the indicator stays out of the way when there's no one else
   * to hide from.
   */
  isPersonal?: boolean;
}) {
  const palette = mealPalette(name);
  const letter = (name || "?").trim().charAt(0).toUpperCase();

  // Inline CSS variables let dark mode flip via `prefers-color-scheme`
  // without a separate JS hook. The `dark:` variants below override
  // the CSS variables when the class kicks in; the tile re-reads the
  // updated value on the next paint.
  const style: React.CSSProperties & Record<string, string> = {
    "--mt-bg": palette.bg,
    "--mt-fg": palette.fg,
    "--mt-dot": palette.dot,
    "--mt-bg-dark": palette.bgDark,
    "--mt-fg-dark": palette.fgDark,
    "--mt-dot-dark": palette.dotDark,
    backgroundColor: "var(--mt-bg)"
  };

  return (
    <div
      style={style}
      className={cn(
        "relative isolate overflow-hidden bg-[color:var(--mt-bg)]",
        // Dark-mode flip — mirrors the CSS-variable swap in globals.css
        // for the rest of the design system, so the monogram inverts
        // automatically when the user's system flips to dark.
        "dark:bg-[color:var(--mt-bg-dark)]",
        TILE_RADIUS[size],
        className
      )}
    >
      {/* Dotted texture overlay — the mobile version paints an 8×8
          absolute-positioned dot grid. On web we cheat with a CSS
          radial-gradient pattern, which RN doesn't have. Same visual
          weight, fewer DOM nodes. The opacity drops the texture below
          the monogram without competing for attention. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-55 dark:opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(var(--mt-dot) 1px, transparent 1.4px)",
          backgroundSize: "14px 14px",
          backgroundPosition: "center"
        }}
      />
      {/* Dark-mode dot color override. Tailwind's arbitrary-value
          syntax doesn't compose into `radial-gradient(...)` cleanly, so
          this sibling layer wins the cascade in dark mode. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden opacity-40 dark:block"
        style={{
          backgroundImage:
            "radial-gradient(var(--mt-dot-dark) 1px, transparent 1.4px)",
          backgroundSize: "14px 14px",
          backgroundPosition: "center"
        }}
      />
      {/* Hairline inner frame matches the mobile spec (palette dot at
          ~40% opacity). Pulled in 6px from the edge so the corner
          radius shows. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[6px] rounded-[inherit] border"
        style={{ borderColor: "color-mix(in srgb, var(--mt-dot) 40%, transparent)" }}
      />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-serif italic leading-none text-[color:var(--mt-fg)] dark:text-[color:var(--mt-fg-dark)]",
          TILE_LETTER_SIZE[size]
        )}
        style={{ letterSpacing: "-0.02em" }}
        aria-hidden
      >
        {letter}
      </span>
      {/* R32 — personal-meal lock indicator. Top-right corner, 12px
          icon, muted color so it doesn't compete with the monogram.
          The lucide `Lock` glyph matches the chip + button on Recipe
          Detail. Only renders when `isPersonal === true`; caller
          composes the prop so this stays a single-prop signal. */}
      {isPersonal ? (
        <span
          aria-label="Personal meal"
          title="Personal — only you see this"
          className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--mt-bg)]/85 text-[color:var(--mt-fg)] dark:bg-[color:var(--mt-bg-dark)]/85 dark:text-[color:var(--mt-fg-dark)]"
        >
          <Lock className="h-3 w-3" strokeWidth={2.2} />
        </span>
      ) : null}
      {/* Hidden semantic label for assistive tech — the monogram is
          decorative; the meal name lives in the parent context. */}
      <span className="sr-only">{name}</span>
    </div>
  );
}
