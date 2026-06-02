import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SettingRow } from "@/components/settings/setting-row";
import { RouteSection } from "@/components/settings/route-section";

export const metadata: Metadata = { title: "Settings · Advanced" };

export default function AdvancedSettingsPage() {
  return (
    <RouteSection title="Advanced" lede="Developer and diagnostic controls.">
      <Card className="overflow-hidden p-0">
        <SettingRow
          label="Developer settings"
          sub="Diagnostics, experimental flags, data sync controls. Lands when we have something to surface here."
          last
        />
      </Card>
    </RouteSection>
  );
}
