import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RouteSection } from "@/components/settings/route-section";
import { PlanManager } from "@/components/settings/plan-manager";
import { CreditsCard } from "@/components/settings/credits-card";

export const metadata: Metadata = { title: "Settings · Plan" };

export default function PlanSettingsPage() {
  return (
    <RouteSection title="Plan" lede="Your subscription, plan options, and AI credit balance.">
      <PlanManager />
      <CreditsCard />
      <Link
        href={"/pricing" as Route}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-primary underline-offset-2 hover:underline"
      >
        Compare full plans
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </RouteSection>
  );
}
