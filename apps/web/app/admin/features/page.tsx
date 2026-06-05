import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { listFeaturesWithCounts } from "@/services/feature-overrides";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Features — admin"
};

export default async function AdminFeaturesPage() {
  await requirePlatformAdmin();
  const features = await listFeaturesWithCounts();

  return (
    <main className="w-full px-5 py-5">
      <header className="mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Feature gates</h1>
        <p className="text-sm text-muted-foreground">
          Default rules apply to all users; per-user / cohort overrides win over
          defaults. See <code className="font-mono-brand">lib/gates/resolver.ts</code> for
          precedence.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border bg-background/60">
        <table className="w-full text-sm">
          <thead className="border-b bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Feature</th>
              <th className="px-4 py-2.5 font-medium">Default rule</th>
              <th className="px-4 py-2.5 font-medium">Overrides</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.feature} className="border-b last:border-0">
                <td className="px-4 py-3 align-top">
                  <div className="font-mono-brand text-xs">{f.feature}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{f.description}</div>
                </td>
                <td className="px-4 py-3 align-top font-mono-brand text-xs text-foreground">
                  {f.defaultRule}
                </td>
                <td className="px-4 py-3 align-top text-foreground">
                  {f.overrideCount}
                </td>
                <td className="px-4 py-3 align-top text-right">
                  <Link
                    href={`/admin/features/${f.feature}` as Route}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
