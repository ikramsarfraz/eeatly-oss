import { cn } from "@/lib/utils";

/**
 * eeatly brand marks (design handoff: "eeatly — Logo System").
 *
 * Hierarchy:
 *   - <Wordmark> is PRIMARY — use anywhere text fits (nav, hero, footer,
 *     auth chrome). Built as inline spans, not a typed string, because
 *     each glyph group carries its own style/color:
 *       ee   → italic Instrument Serif, forest
 *       atly → roman  Instrument Serif, ink
 *       ·    → terracotta dot (dropped at small sizes, ≤32px)
 *   - <Mark> is COMPACT-ONLY — a single italic `e` on a forest squircle.
 *     For app icon / favicon / avatar slots where the wordmark won't fit.
 *
 * Colors are the handoff's exact hexes with dark-mode siblings (the app
 * toggles `.dark` via next-themes). `font-serif` resolves to Instrument
 * Serif in this app (globals.css).
 */

type WordmarkProps = {
  /** font-size in px. Size ladder: 156 display · 96 hero · 56 title · 32 nav · 20 footer. */
  size?: number;
  /** Force the trailing terracotta dot on/off. Defaults to on above 32px. */
  dot?: boolean;
  className?: string;
};

export function Wordmark({ size = 32, dot, className }: WordmarkProps) {
  // The lockup omits the dot at nav (32) and footer (20) sizes.
  const showDot = dot ?? size > 32;
  return (
    <span
      role="img"
      aria-label="eeatly"
      className={cn("inline-flex select-none items-baseline font-serif leading-none", className)}
      style={{ fontSize: size, lineHeight: 0.85, letterSpacing: "-0.045em" }}
    >
      <span aria-hidden className="italic text-[#2E5739] dark:text-[#88B894]">
        ee
      </span>
      <span aria-hidden className="text-[#1A1F1A] dark:text-[#F0E9D9]">
        atly
      </span>
      {showDot ? (
        <span
          aria-hidden
          className="self-end rounded-full bg-[#C66B47] dark:bg-[#D88865]"
          style={{
            width: "0.07em",
            height: "0.07em",
            marginBottom: "0.12em",
            marginLeft: "0.04em"
          }}
        />
      ) : null}
    </span>
  );
}

type MarkProps = {
  /** Square px size. Ladder: 180 iOS · 120 · 60 · 32 · 16 favicon. */
  size?: number;
  /** Force the wheat/terra accent dot. Defaults to on at ≥120px only. */
  dot?: boolean;
  className?: string;
};

export function Mark({ size = 40, dot, className }: MarkProps) {
  const showDot = dot ?? size >= 120;
  return (
    <span
      role="img"
      aria-label="eeatly"
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden bg-[#2E5739] dark:bg-[#88B894]",
        className
      )}
      style={{ width: size, height: size, borderRadius: "22.37%" }}
    >
      <span
        aria-hidden
        className="font-serif italic text-[#F5EFE2] dark:text-[#10180F]"
        style={{ fontSize: size * 0.62, lineHeight: 0.78, letterSpacing: "-0.04em" }}
      >
        e
      </span>
      {showDot ? (
        <span
          aria-hidden
          className="absolute rounded-full bg-[#D9C68C] dark:bg-[#C66B47]"
          style={{
            width: size * 0.08,
            height: size * 0.08,
            right: size * 0.2,
            bottom: size * 0.24
          }}
        />
      ) : null}
    </span>
  );
}
