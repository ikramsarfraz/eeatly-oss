import { cn } from "@/lib/utils";

/**
 * Round 21 — small mono-caps eyebrow used as a section header on the
 * recipe view (and any future surface that needs the same treatment).
 * Mirrors the inline mono-uppercase pattern the mobile screens use
 * inline; lifted to a primitive so web pages stop hand-rolling the
 * class string.
 */
export function SectionLabel({
  children,
  className,
  id
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
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
