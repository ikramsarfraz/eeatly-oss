"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Round 31 — System / Light / Dark pill row.
 *
 * Reads the current theme via `next-themes`' `useTheme()` hook and
 * lets the user switch between OS-tracking and the two explicit
 * appearances. The class-based theming set up in `app/layout.tsx`
 * (and the migrated `.dark` selectors in `globals.css`) means the
 * variable swap happens automatically when `setTheme()` toggles the
 * `class` attribute on `<html>`.
 *
 * The hook returns `undefined` for `theme` during SSR / pre-mount,
 * which would render the row with no active pill on first paint. We
 * guard with a `mounted` flag and render a placeholder row server-
 * side, swapping to the live state once hydration completes. This
 * matches the standard `next-themes` recipe and avoids the FOUC
 * where System briefly highlights before user-preferred Light flips
 * in.
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

  const value = mounted ? (theme ?? "system") : "system";

  const options = [
    { value: "system", label: "System", Icon: Monitor },
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
