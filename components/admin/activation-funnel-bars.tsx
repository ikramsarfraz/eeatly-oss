function formatGapHours(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  if (value < 72) {
    return `${Math.round(value)} hrs between logs`;
  }

  const days = value / 24;

  return `${days >= 10 ? Math.round(days) : Math.round(days * 10) / 10} day avg gap`;
}

type ActivationFunnelBarsProps = {
  funnel: {
    onboardingPct: number;
    firstMealPct: number;
    secondMealPct: number;
    rediscoveryPct: number;
  };
};

function Bar({
  label,
  valuePct,
  footnote
}: {
  label: string;
  valuePct: number;
  footnote: string;
}) {
  const width = Math.max(6, Math.min(100, valuePct));

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <p className="font-medium leading-tight text-foreground">{label}</p>
        <span className="text-muted-foreground">{valuePct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{footnote}</p>
    </div>
  );
}

export function ActivationFunnelBars({ funnel }: ActivationFunnelBarsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Bar
        label="Onboarding completed"
        valuePct={funnel.onboardingPct}
        footnote="Distinct accounts that marked onboarding guidance as done."
      />
      <Bar
        label="First meal logged"
        valuePct={funnel.firstMealPct}
        footnote="% of accounts with ≥1 logged meal entry."
      />
      <Bar
        label="Second meal conversion"
        valuePct={funnel.secondMealPct}
        footnote="% of accounts with a first meal that logged at least twice."
      />
      <Bar
        label="Rediscovery engagement"
        valuePct={funnel.rediscoveryPct}
        footnote="% of accounts that tapped Useful idea on resurfaced meals."
      />
    </div>
  );
}

export { formatGapHours };
