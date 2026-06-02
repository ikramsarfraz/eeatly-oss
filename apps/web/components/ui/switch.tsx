"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Switch — Radix-backed on/off toggle. Dimensions match the hand-rolled
 * toggles it replaces (h-6 / w-[42px], 20px thumb, 18px travel) so existing
 * layouts don't shift. Colors use the app's CSS-var tokens.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-[42px] shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-[color:var(--primary)] data-[state=unchecked]:bg-[var(--border-strong,var(--border))]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[var(--shadow-sm)] ring-0 transition-transform",
          "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
