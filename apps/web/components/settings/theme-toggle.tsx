"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light / Dark pill row.
 *
 * The app defaults to Light (see `app/layout.tsx`) and does not track the OS
 * appearance — a dark-OS user still gets light unless they explicitly pick
 * Dark here. The class-based theming (the `.dark` selectors in `globals.css`)
 * means the variable swap happens automatically when `setTheme()` toggles the
 * `class` attribute on `<html>`.
 *
 * The hook returns `undefined` for `theme` during SSR / pre-mount, which would
 * render the row with no active pill on first paint. We guard with a `mounted`
 * flag and render a Light-stable placeholder server-side, swapping to the live
 * state once hydration completes (standard `next-themes` recipe, avoids FOUC).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Standard next-themes recipe — see file-level comment. The lint
  // rule guards against cascading-render setState calls; here we
  // intentionally flip once on mount to swap from the SSR-stable
  // placeholder to the live theme value, so the cascading render is
  // exactly the intent.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes mount swap (single transition, intentional)
    setMounted(true);
  }, []);

  // Treat anything that isn't an explicit "dark" as Light (covers the default
  // and any stale "system" value from before OS-tracking was removed).
  const value = mounted && theme === "dark" ? "dark" : "light";

  const options = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon }
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="inline-flex items-center gap-1 rounded-full border bg-[var(--surface-2)] p-1"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
