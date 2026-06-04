import { Activity, BarChart3, ImageIcon, Layers, Users as UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { Route } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAiUsageSummary, imageModelLabel } from "@/services/ai-usage";
import { TIERS, type Tier } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tierName = (t: Tier) => TIERS[t].name;
const marginClass = (n: number) =>
  n >= 0 ? "text-[color:var(--primary)]" : "text-[color:var(--destructive,#c0392b)]";

const RANGES: Array<{ value: string; label: string; days: number | null }> = [
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "all", label: "All time", days: null }
];

const windowLabel = (days: number | null) => (days === null ? "all time" : `last ${days}d`);

export default async function AdminAiUsagePage({
  searchParams
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePlatformAdmin();
  const { range } = await searchParams;
  // Default to all-time (lifetime); the filter narrows it.
  const selected = RANGES.find((r) => r.value === range) ?? RANGES[3];
  const data = await getAiUsageSummary(selected.days);
  const { totals } = data;
  const wl = windowLabel(data.windowDays);

  const stats: Array<[string, string, string?]> = [
    ["Credits spent", totals.creditsSpent.toLocaleString(), wl],
    ["Est. AI cost (COGS)", usd(totals.estCogsUsd), wl],
    ["MRR", usd(totals.mrrUsd), `${totals.activePaidSubs} active paid`],
    ["Gross margin", usd(totals.grossMarginUsd), `MRR − cost (${wl})`],
    ["Active users", totals.spendingUsers.toLocaleString(), wl]
  ];

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">Platform admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">AI usage &amp; cost</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Usage, credits, and provider cost across <strong>all users</strong> ({wl}),
          sorted by AI cost. LLM cost is from <strong>real tokens × model price</strong>;
          voice transcription and image generation are flat model-priced add-ons.
          MRR is current; pick <em>30 days</em> for a monthly-comparable margin.
        </p>
        {/* Window filter — all-time by default. */}
        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
          {RANGES.map((r) => {
            const active = r.value === selected.value;
            return (
              <Link
                key={r.value}
                href={`/admin/ai-usage?range=${r.value}` as Route}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-[var(--surface)] text-foreground shadow-[var(--shadow-sm)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Headline stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {stats.map(([label, value, hint]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 font-serif text-[26px] leading-none text-foreground">{value}</p>
              {hint ? <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p> : null}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* By operation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" /> By operation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byOperation.length === 0 ? (
            <Empty>No AI usage in the window yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byOperation.map((op) => (
                  <TableRow key={op.operation}>
                    <TableCell className="whitespace-nowrap">{op.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {op.invocations.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {op.creditsSpent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{usd(op.estCogsUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dish image models — which provider actually rendered the images. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5 text-primary" /> Dish image models
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.imageModels.length === 0 ? (
            <Empty>No dish images generated yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Images</TableHead>
                  <TableHead className="text-right">Last used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.imageModels.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell className="whitespace-nowrap">{imageModelLabel(m.model)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {m.lastAt
                        ? new Date(m.lastAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* By tier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" /> By tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byTier.length === 0 ? (
            <Empty>No spending users in the window.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                  <TableHead className="text-right">Revenue / mo</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byTier.map((t) => (
                  <TableRow key={t.tier}>
                    <TableCell className="whitespace-nowrap">{tierName(t.tier)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.users}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.creditsSpent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{usd(t.estCogsUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(t.revenueUsd)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${marginClass(t.revenueUsd - t.estCogsUsd)}`}
                    >
                      {usd(t.revenueUsd - t.estCogsUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top spenders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersIcon className="h-5 w-5 text-primary" /> All users · by AI cost ({wl})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.users.length === 0 ? (
            <Empty>No AI usage in this window yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                  <TableHead className="text-right">Revenue / mo</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell className="whitespace-nowrap">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {tierName(u.tier)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.creditsSpent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{usd(u.estCogsUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usd(u.monthlyRevenueUsd)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${marginClass(u.marginUsd)}`}>
                      {usd(u.marginUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        Margin compares a user&apos;s monthly subscription revenue against their estimated
        AI cost ({wl}) — negative means they spent more in AI than they pay. Use the 30-day
        window for a monthly-comparable figure.
      </p>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/60 p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
