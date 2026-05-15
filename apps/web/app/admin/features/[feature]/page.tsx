import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { format } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { FEATURE_REGISTRY, isFeatureKey } from "@eeatly/api/gates/registry";
import { listOverridesForFeature } from "@/services/feature-overrides";
import { FeatureOverridesPanel } from "@/components/admin/feature-overrides-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feature overrides — admin"
};

export default async function AdminFeatureDetailPage(props: {
  params: Promise<{ feature: string }>;
}) {
  await requirePlatformAdmin();
  const { feature } = await props.params;
  if (!isFeatureKey(feature)) notFound();

  const overrides = await listOverridesForFeature(feature);
  const config = FEATURE_REGISTRY[feature];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href={"/admin/features" as Route}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← All features
      </Link>
      <header className="mt-2 grid gap-1">
        <h1 className="font-mono-brand text-xl font-semibold">{feature}</h1>
        <p className="text-sm text-muted-foreground">{config.description}</p>
        <p className="text-xs text-muted-foreground">
          Default rule:{" "}
          <span className="font-mono-brand text-foreground">{config.defaultRule}</span>
        </p>
      </header>

      <FeatureOverridesPanel
        feature={feature}
        overrides={overrides.map((o) => ({
          id: o.id,
          userId: o.userId,
          userName: o.userName,
          userEmail: o.userEmail,
          cohort: o.cohort,
          ruleOverride: o.ruleOverride,
          createdAt: format(o.createdAt, "MMM d, yyyy")
        }))}
      />
    </main>
  );
}
