"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft, Search, X } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { MealTile } from "@/components/ui/meal-tile";

const RECENTS_KEY = "eeatly:recent-searches";

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 6) : [];
  } catch {
    return [];
  }
}

/**
 * R35 mobile-web Search screen (also the desktop /search route; the command
 * palette stays the desktop quick-search). Live field over the same
 * `trpc.search.meals` query the palette uses; results link to the recipe.
 * Renders full-bleed below `md`, centered card above it.
 */
export function SearchMobile() {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [recents, setRecents] = React.useState<string[]>([]);

  // Populate from localStorage after mount (deferred so the initial render
  // matches SSR's empty list — avoids a hydration mismatch + the
  // set-state-in-effect lint).
  React.useEffect(() => {
    const id = setTimeout(() => setRecents(readRecents()), 0);
    return () => clearTimeout(id);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 200);
    return () => clearTimeout(t);
  }, [value]);

  const query = trpc.search.meals.useQuery(
    { q: debounced, limit: 30 },
    { enabled: debounced.length >= 1, staleTime: 30_000 }
  );

  const commitRecent = React.useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...readRecents().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    try {
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setRecents(next);
  }, []);

  const rows = query.data ?? [];
  const hasQuery = debounced.length >= 1;

  return (
    <div className="-mx-4 -mt-5 font-[family-name:var(--font-geist)] text-foreground md:mx-auto md:mt-0 md:max-w-2xl">
      {/* Search field bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-border bg-background px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)]">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.back()}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-muted-foreground md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-[42px] flex-1 items-center gap-2 rounded-[12px] border border-border bg-card px-3">
          <Search className="h-[18px] w-[18px] shrink-0 text-[color:var(--ink3)]" />
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search meals, plans, ingredients"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[color:var(--ink3)]"
          />
          {value && (
            <button type="button" aria-label="Clear" onClick={() => setValue("")} className="shrink-0 text-[color:var(--ink3)]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!hasQuery ? (
        <div className="px-4 pt-5">
          {recents.length > 0 ? (
            <>
              <h2 className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
                Recent
              </h2>
              <div className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setValue(r)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-foreground"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="pt-10 text-center text-[14px] text-muted-foreground">
              Search across everything you&apos;ve saved.
            </p>
          )}
        </div>
      ) : query.isLoading ? (
        <div className="px-4 py-10 text-center text-[14px] text-muted-foreground">Searching…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-[14px] text-muted-foreground">
          No matches for &ldquo;{debounced}&rdquo;.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/meal/${row.id}` as Route}
                onClick={() => commitRecent(debounced)}
                className="flex items-center gap-3 px-4 py-3 active:bg-[color:var(--surface-2)]"
              >
                <MealTile name={row.name} size="s" className="h-11 w-11 shrink-0 rounded-[10px] border" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">{row.name}</span>
                <Search className="h-4 w-4 shrink-0 -rotate-90 text-[color:var(--ink4)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
