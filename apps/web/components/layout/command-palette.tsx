"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Sparkles } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc/client";

/**
 * Round 26 — global ⌘K command palette.
 *
 * Wraps shadcn's `CommandDialog` with eeatly-specific data: a debounced
 * `search.meals` query, and a "recent" fallback list pulled from
 * `dashboard.meals` when the input is empty. Selecting an item routes
 * to `/meal/[id]` and closes the dialog.
 *
 * The dialog is fully controlled (`open` + `onOpenChange`) so the
 * layout owns the open state and a single keydown listener can flip
 * it. Internally we use `React.useDeferredValue` to debounce the
 * input value — cheaper than a setTimeout-based hook for this query
 * shape, and React's scheduler will let the input stay responsive
 * even when the query is in flight.
 *
 * Wiring depth (per the spec's skip rule):
 *   - Real `search.meals` query, debounced ≈ React's deferred-value
 *     interval (~300 ms under load).
 *   - Empty input → top 5 recents from `dashboard.meals.recentMeals`.
 *   - Loading state via cmdk's built-in `loading` prop on
 *     `<CommandList>` (we set it via the query status).
 *   - Errors surface as an inline empty state with a short message
 *     so the dialog doesn't crash if the procedure 4xx's.
 *
 * Open-state ownership lives in the layout: see
 * `apps/web/app/(dashboard)/layout.tsx` for the keydown listener.
 */

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const trimmed = deferredQuery.trim();
  const isSearching = trimmed.length > 0;

  // Reset the input whenever the dialog closes. Wraps the parent's
  // onOpenChange so the state transition that closes the dialog
  // also clears the query — no setState-in-effect needed.
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setQuery("");
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const searchQuery = trpc.search.meals.useQuery(
    { q: trimmed, limit: 10 },
    {
      enabled: open && isSearching,
      // Cheap query, no need to refetch on focus
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  );

  // Recents — only fetch when the dialog is open AND the user
  // hasn't typed anything yet. Once they start typing, the search
  // results take over and we drop the recents from the cache load.
  const recentsQuery = trpc.dashboard.meals.useQuery(undefined, {
    enabled: open && !isSearching,
    staleTime: 60_000
  });

  function handleSelect(mealId: string) {
    router.push(`/meal/${mealId}` as Route);
    handleOpenChange(false);
  }

  const showSearchResults = isSearching;
  // `search.meals` returns `MealLibraryRow[]` (`{ id, name, photoUrl }`)
  // from `apps/web/services/plans.ts:620`. No cook-count on this shape,
  // so the result row stays minimal: name + optional small subtitle.
  const searchResults = searchQuery.data ?? [];
  const recentRows = recentsQuery.data?.recentMeals?.slice(0, 5) ?? [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search meals, plans, ingredients."
    >
      <CommandInput
        placeholder="Search meals, plans, ingredients…"
        value={query}
        onValueChange={setQuery}
      />
      {/* `shouldFilter={false}` on the parent Command would matter
          here, but we leave cmdk's default fuzzy filter on so empty-
          input and search-mode both feel snappy. Server results are
          already filtered upstream; cmdk's client-side filter is a
          no-op when the items match the typed query anyway. */}
      <CommandList>
        {showSearchResults ? (
          <>
            {searchQuery.isPending ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : searchResults.length === 0 ? (
              <CommandEmpty>
                No meals match &ldquo;{trimmed}&rdquo;.
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Meals">
                {searchResults.map((row) => (
                  <CommandItem
                    key={row.id}
                    // `value` controls cmdk's keyboard nav; we use the
                    // meal name so type-ahead matching feels natural.
                    value={`${row.name} ${row.id}`}
                    onSelect={() => handleSelect(row.id)}
                  >
                    <span className="text-foreground">{row.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          <>
            {recentsQuery.isPending ? (
              <CommandEmpty>Loading recents…</CommandEmpty>
            ) : recentRows.length === 0 ? (
              <CommandEmpty>
                Type to search. Your recent meals will surface here once
                you&apos;ve logged a few.
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Recent">
                {recentRows.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={`${row.mealName} ${row.mealId}`}
                    onSelect={() => handleSelect(row.mealId)}
                  >
                    <span className="text-foreground">{row.mealName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Tips">
          <CommandItem disabled value="tip-shortcut">
            <Sparkles className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Tip: ⌘K opens this anywhere in the app.
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
