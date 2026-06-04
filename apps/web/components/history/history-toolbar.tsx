"use client";

import * as React from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Breakpoint } from "@/hooks/use-breakpoint";
import type { HistoryTab } from "@/services/meals";
import type { EffortLevel } from "@/types";

type ToolbarProps = {
  bp: Breakpoint;
  tab: HistoryTab;
  counts: { recent: number; most: number; neglected: number };
  onTabChange: (tab: HistoryTab) => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  effortLevels: EffortLevel[];
  onEffortLevelsChange: (next: EffortLevel[]) => void;
  rangeDays: number | null;
  onRangeDaysChange: (next: number | null) => void;
};

const TABS: { value: HistoryTab; label: string; countKey: "recent" | "most" | "neglected" }[] = [
  { value: "recent", label: "Recent", countKey: "recent" },
  { value: "most", label: "Most cooked", countKey: "most" },
  { value: "neglected", label: "Neglected", countKey: "neglected" }
];

const EFFORT_OPTIONS: { value: EffortLevel; label: string }[] = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "Project" }
];

const RANGE_OPTIONS: { value: number | null; label: string }[] = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "This year" },
  { value: null, label: "All time" }
];

export function HistoryToolbar({
  bp,
  tab,
  counts,
  onTabChange,
  searchValue,
  onSearchChange,
  effortLevels,
  onEffortLevelsChange,
  rangeDays,
  onRangeDaysChange
}: ToolbarProps) {
  const filtersActive = effortLevels.length > 0 || rangeDays !== null;
  const rangeLabel =
    RANGE_OPTIONS.find((opt) => opt.value === rangeDays)?.label ?? "All time";

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:flex md:items-center md:gap-3">
        <Segmented tab={tab} counts={counts} onTabChange={onTabChange} />
        <div className="flex flex-1 items-center gap-2">
          <SearchInput value={searchValue} onChange={onSearchChange} bp={bp} />
          {bp === "mobile" ? (
            <FilterSheet
              effortLevels={effortLevels}
              onEffortLevelsChange={onEffortLevelsChange}
              rangeDays={rangeDays}
              onRangeDaysChange={onRangeDaysChange}
              hasActive={filtersActive}
            />
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <EffortDropdown
                effortLevels={effortLevels}
                onEffortLevelsChange={onEffortLevelsChange}
              />
              <RangeDropdown
                rangeDays={rangeDays}
                onRangeDaysChange={onRangeDaysChange}
                label={rangeLabel}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Segmented({
  tab,
  counts,
  onTabChange
}: Pick<ToolbarProps, "tab" | "counts" | "onTabChange">) {
  return (
    <div
      role="tablist"
      aria-label="History view"
      className="inline-flex gap-0.5 rounded-[11px] border border-border bg-[var(--surface-2)] p-1"
    >
      {TABS.map((t) => {
        const active = t.value === tab;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(t.value)}
            className={cn(
              "flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-[var(--surface)] text-foreground shadow-[0_1px_2px_rgba(27,34,32,0.06),0_0_0_1px_rgba(27,34,32,0.05)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-[5px] px-[6px] py-px font-mono-brand text-[10.5px]",
                active ? "bg-[var(--surface-2)] text-foreground" : "text-muted-foreground"
              )}
            >
              {counts[t.countKey]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  bp
}: {
  value: string;
  onChange: (v: string) => void;
  bp: Breakpoint;
}) {
  const widthClass =
    bp === "desktop" ? "md:max-w-[380px]" : bp === "tablet" ? "md:max-w-[260px]" : "";
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-2 rounded-[9px] border border-border bg-[var(--surface)] px-3 py-2 text-sm",
        widthClass
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search meals, notes, ingredients…"
        className="flex-1 border-0 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
        aria-label="Search history"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-[var(--surface-2)]"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function EffortDropdown({
  effortLevels,
  onEffortLevelsChange
}: Pick<ToolbarProps, "effortLevels" | "onEffortLevelsChange">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)]"
        >
          Effort
          {effortLevels.length > 0 ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {effortLevels.length}
            </span>
          ) : null}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EFFORT_OPTIONS.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={effortLevels.includes(opt.value)}
            onCheckedChange={(next) => {
              if (next) onEffortLevelsChange([...effortLevels, opt.value]);
              else onEffortLevelsChange(effortLevels.filter((v) => v !== opt.value));
            }}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RangeDropdown({
  rangeDays,
  onRangeDaysChange,
  label
}: Pick<ToolbarProps, "rangeDays" | "onRangeDaysChange"> & { label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)]"
        >
          {label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={rangeDays === null ? "all" : String(rangeDays)}
          onValueChange={(value) => {
            if (value === "all") onRangeDaysChange(null);
            else onRangeDaysChange(Number(value));
          }}
        >
          {RANGE_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem
              key={opt.value ?? "all"}
              value={opt.value === null ? "all" : String(opt.value)}
            >
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterSheet({
  effortLevels,
  onEffortLevelsChange,
  rangeDays,
  onRangeDaysChange,
  hasActive
}: Pick<
  ToolbarProps,
  "effortLevels" | "onEffortLevelsChange" | "rangeDays" | "onRangeDaysChange"
> & { hasActive: boolean }) {
  const [open, setOpen] = React.useState(false);
  // Stage changes locally so users can preview before applying.
  const [draftEffort, setDraftEffort] = React.useState<EffortLevel[]>(effortLevels);
  const [draftRange, setDraftRange] = React.useState<number | null>(rangeDays);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    // Reset the draft state whenever the sheet opens so a previous-cancel
    // staging doesn't bleed into the next open. Effect-driven state is
    // the right shape here — the open transition is what we're syncing on.
    if (open) {
      setDraftEffort(effortLevels);
      setDraftRange(rangeDays);
    }
  }, [open, effortLevels, rangeDays]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function apply() {
    onEffortLevelsChange(draftEffort);
    onRangeDaysChange(draftRange);
    setOpen(false);
  }
  function reset() {
    setDraftEffort([]);
    setDraftRange(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={hasActive ? "Filters (active)" : "Filters"}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-[var(--surface)] text-foreground transition-colors hover:bg-[var(--surface-2)]"
        >
          <Filter className="h-4 w-4" />
          {hasActive ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter history</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <fieldset className="grid gap-2">
            <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Effort
            </legend>
            <div className="flex flex-wrap gap-2">
              {EFFORT_OPTIONS.map((opt) => {
                const active = draftEffort.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (active) setDraftEffort(draftEffort.filter((v) => v !== opt.value));
                      else setDraftEffort([...draftEffort, opt.value]);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                      active
                        ? "border-primary bg-[var(--primary-soft)] text-primary"
                        : "border-border bg-[var(--surface)] text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Time range
            </legend>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((opt) => {
                const active = draftRange === opt.value;
                return (
                  <button
                    key={opt.value ?? "all"}
                    type="button"
                    onClick={() => setDraftRange(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                      active
                        ? "border-primary bg-[var(--primary-soft)] text-primary"
                        : "border-border bg-[var(--surface)] text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={reset}
              className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={apply}
              // R23 — `#266a51` is the darker forest hover. In dark
              // mode `--primary` flips to a lighter sage, so the
              // hardcoded darken doesn't apply; use opacity for the
              // hover signal instead.
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[#266a51] dark:hover:bg-primary/85"
            >
              Apply filters
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
