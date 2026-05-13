"use client";

import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Forces the sidebar to its rail (collapsed) state when the viewport is in the
 * tablet tier (820–1079px), per the Responsive Shell handoff. The toggle is
 * also hidden in that range — this hook backs that visual rule with state.
 *
 * Outside tablet width, the user's last preference (persisted via shadcn's
 * sidebar_state cookie) takes over again.
 */
export function TabletRailEnforcer() {
  const { setOpen } = useSidebar();

  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 820px) and (max-width: 1079px)");
    const enforce = () => {
      if (mql.matches) setOpen(false);
    };
    enforce();
    mql.addEventListener("change", enforce);
    return () => mql.removeEventListener("change", enforce);
  }, [setOpen]);

  return null;
}
