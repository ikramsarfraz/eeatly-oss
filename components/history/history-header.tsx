type HistoryHeaderProps = {
  stats: {
    thisYear: number;
    thisMonth: number;
    neglectedCount: number;
  };
};

export function HistoryHeader({ stats }: HistoryHeaderProps) {
  return (
    <header className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end md:gap-8">
      <div className="grid gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Cooking history
        </p>
        <h1 className="font-serif text-[32px] font-normal leading-[1.1] tracking-[-0.015em] sm:text-4xl lg:text-[42px]">
          Your meal <em className="italic text-primary">memory.</em>
        </h1>
        <p className="max-w-[480px] text-[14px] leading-[1.55] text-muted-foreground">
          Review what you have cooked, spot reliable repeats, and log old favorites again
          when they come back into rotation.
        </p>
      </div>
      <Stats stats={stats} />
    </header>
  );
}

function Stats({ stats }: { stats: HistoryHeaderProps["stats"] }) {
  return (
    <div className="grid grid-cols-3 rounded-[12px] border border-border bg-[var(--surface)] md:rounded-none md:border-0 md:bg-transparent">
      <StatCell value={stats.thisYear} label="this year" />
      <StatCell value={stats.thisMonth} label="this month" delta="positive" />
      <StatCell value={stats.neglectedCount} label="neglected" delta="negative" />
    </div>
  );
}

function StatCell({
  value,
  label,
  delta
}: {
  value: number;
  label: string;
  delta?: "positive" | "negative";
}) {
  const deltaColor =
    delta === "positive"
      ? "text-primary"
      : delta === "negative"
        ? "text-[var(--accent)]"
        : "text-muted-foreground";

  return (
    <div className="grid gap-0.5 border-l border-border px-3 py-3 first:border-l-0 md:border-l md:px-5">
      <span className="font-serif text-[22px] leading-none lg:text-[26px]">{value}</span>
      <span className={`text-[10.5px] font-medium uppercase tracking-[0.06em] ${deltaColor}`}>
        {label}
      </span>
    </div>
  );
}
