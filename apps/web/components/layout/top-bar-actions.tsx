"use client";

import * as React from "react";

/**
 * Round 26 — per-page right-side actions slot for the new TopBar.
 *
 * Pages register their actions via `useSetTopBarActions(node)`; the
 * TopBar reads the current node via `useTopBarActions()`. Pattern
 * mirrors the way Next.js's `useFormStatus`-style providers work
 * without coupling pages to a parent prop.
 *
 *   - The slot is intentionally a single ReactNode (not a fragment)
 *     so unmount cleanup is unambiguous: the page's effect sets a
 *     node on mount and clears it on unmount.
 *   - The provider lives at the dashboard layout level. Any descendant
 *     can call the setter; cleanup runs even on fast nav between
 *     pages because the effect's return is invoked on unmount.
 *
 * Pages that don't register actions render an empty right cluster —
 * the bell + search trigger still appear, just no per-page slot.
 */

type TopBarActionsContextValue = {
  node: React.ReactNode;
  setNode: (node: React.ReactNode) => void;
};

const TopBarActionsContext =
  React.createContext<TopBarActionsContextValue | null>(null);

export function TopBarActionsProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [node, setNode] = React.useState<React.ReactNode>(null);
  const value = React.useMemo(() => ({ node, setNode }), [node]);
  return (
    <TopBarActionsContext.Provider value={value}>
      {children}
    </TopBarActionsContext.Provider>
  );
}

export function useTopBarActions(): React.ReactNode {
  const ctx = React.useContext(TopBarActionsContext);
  return ctx?.node ?? null;
}

/**
 * Register a node in the TopBar's right action slot for the lifetime
 * of the calling component. Cleanup happens automatically on unmount.
 *
 * Pages that need top-bar actions call this with a memoised node:
 *
 *   useSetTopBarActions(
 *     useMemo(
 *       () => (
 *         <Button asChild variant="default">
 *           <Link href="/plans/new">New plan</Link>
 *         </Button>
 *       ),
 *       []
 *     )
 *   );
 */
export function useSetTopBarActions(node: React.ReactNode): void {
  const ctx = React.useContext(TopBarActionsContext);
  React.useEffect(() => {
    if (!ctx) return;
    ctx.setNode(node);
    return () => {
      ctx.setNode(null);
    };
  }, [ctx, node]);
}
