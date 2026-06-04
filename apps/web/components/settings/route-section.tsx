import * as React from "react";

/**
 * R32 — the content wrapper each settings route renders. Provides the
 * editorial route head (display-serif title + lede) and the transform-only
 * entrance animation (re-triggers on every route change since each page
 * remounts). Server component — no interactivity of its own.
 */
export function RouteSection({
  title,
  lede,
  children
}: {
  title: string;
  lede: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-route-in grid gap-7">
      <div className="grid gap-2">
        <h2
          className="font-serif text-[38px] leading-[1.05] text-foreground"
          style={{ letterSpacing: "-0.025em" }}
        >
          {title}
        </h2>
        <p className="max-w-[560px] text-[14px] leading-[1.6] text-muted-foreground">{lede}</p>
      </div>
      {children}
    </div>
  );
}
