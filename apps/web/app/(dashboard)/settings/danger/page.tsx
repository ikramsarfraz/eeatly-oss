import type { Metadata } from "next";
import { RouteSection } from "@/components/settings/route-section";
import { DangerSection } from "@/components/settings/section-bodies";

export const metadata: Metadata = { title: "Settings · Danger zone" };

export default function DangerSettingsPage() {
  return (
    <RouteSection title="Danger zone" lede="Irreversible actions. Proceed carefully.">
      <DangerSection />
    </RouteSection>
  );
}
