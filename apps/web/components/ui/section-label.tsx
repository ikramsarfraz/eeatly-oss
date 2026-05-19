import { cn } from "@/lib/utils";

/**
 * Round 21 — small mono-caps eyebrow used as a section header on the
 * recipe view (and any future surface that needs the same treatment).
 * Mirrors the inline mono-uppercase pattern the mobile screens use
 * inline; lifted to a primitive so web pages stop hand-rolling the
 * class string.
 *
 * R26 — optional `action` slot, right-aligned on the same baseline.
 * Used by the new Home page (and other R26+ surfaces) to surface a
 * "See all" / "New plan" link next to a section heading. When `action`
 * is absent the element renders as a plain `<p>` exactly as before —
 * existing call sites (Recipe Detail R21, Review screen, etc.) stay
 * pixel-identical.
 */
export function SectionLabel({
  children,
  className,
  id,
  action
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Right-aligned slot — typically a small `<Link>` or button. */
  action?: React.ReactNode;
}) {
  if (action) {
    return (
      <div
        className={cn(
          "flex items-baseline justify-between gap-3",
          className
        )}
      >
        <p
          id={id}
          className="font-mono text-[11px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          {children}
        </p>
        <div className="shrink-0">{action}</div>
      </div>
    );
  }
  return (
    <p
      id={id}
      className={cn(
        "font-mono text-[11px] uppercase text-muted-foreground",
        className
      )}
      style={{ letterSpacing: "0.14em" }}
    >
      {children}
    </p>
  );
}
