import { cn } from "@/lib/utils";

/**
 * Round 31 — Settings row primitive.
 *
 * Each section in the new Settings page is a Card with one or more
 * Row children. The Row shape:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Label                              [value · mono] [suffix] │
 *   │ Sub text                                                  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Borders drop on the last row inside a Card so the Card's own
 * border owns the bottom edge.
 */

export function SettingRow({
  label,
  sub,
  value,
  suffix,
  last,
  danger
}: {
  label: string;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Drop the bottom border. Set on the last row inside a Card so the
   *  Card's own border owns the edge. */
  last?: boolean;
  /** Render the label in danger-fg so the Danger zone rows read as
   *  destructive without surrounding the whole Card in red. */
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4",
        last ? "" : "border-b border-[var(--border-soft,var(--border))]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[14px] font-semibold leading-tight",
            danger ? "text-[color:var(--danger-fg)]" : "text-foreground"
          )}
        >
          {label}
        </p>
        {sub ? (
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
            {sub}
          </p>
        ) : null}
      </div>
      {value ? (
        <span
          className="font-mono text-[12px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          {value}
        </span>
      ) : null}
      {suffix ? <div className="flex shrink-0 items-center">{suffix}</div> : null}
    </div>
  );
}
