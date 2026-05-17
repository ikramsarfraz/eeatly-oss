import { cn } from "@/lib/utils";

/**
 * Round 21 — web port of the mobile `PageTitle` primitive
 * (`apps/mobile/components/ui/page-title.tsx`). The editorial anchor:
 * an optional italic-serif kicker, a large Instrument Serif display
 * title, optional mono-caps eyebrow, and an optional sans subtitle.
 *
 * Sizes mirror the mobile scale, but use this round's `s/m/l/xl`
 * naming (rather than mobile's `sm/md/lg/xl`) to match the R21 spec.
 * Pixel values are tuned for web reading distance and the dashboard's
 * 720px max-width — slightly tighter than the mobile equivalents,
 * which assume a 390pt viewport.
 */
type PageTitleSize = "s" | "m" | "l" | "xl";

const TITLE_SIZE: Record<PageTitleSize, string> = {
  s: "text-[22px] leading-[1.05]",
  m: "text-[28px] leading-[1.05] sm:text-[30px]",
  l: "text-[36px] leading-[1.02] sm:text-[40px]",
  xl: "text-[44px] leading-[1.0] sm:text-[52px]"
};

type PageTitleProps = {
  title: string;
  size?: PageTitleSize;
  /** Italic kicker shown above title in Instrument Serif italic. */
  kicker?: string;
  /** Uppercase mono eyebrow below title (typically a date or status). */
  eyebrow?: string;
  /** Subtitle paragraph in sans body below title. */
  subtitle?: string;
  className?: string;
};

export function PageTitle({
  title,
  size = "m",
  kicker,
  eyebrow,
  subtitle,
  className
}: PageTitleProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {kicker ? (
        <p className="font-serif text-[15px] italic text-muted-foreground sm:text-[16px]">
          {kicker}
        </p>
      ) : null}
      <h1
        className={cn(
          "font-serif font-normal text-foreground",
          TITLE_SIZE[size]
        )}
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h1>
      {eyebrow ? (
        <p
          className="mt-1 font-mono text-[11px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.12em" }}
        >
          {eyebrow}
        </p>
      ) : null}
      {subtitle ? (
        <p className="mt-1 text-[14px] leading-[1.45] text-muted-foreground sm:text-[15px]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
