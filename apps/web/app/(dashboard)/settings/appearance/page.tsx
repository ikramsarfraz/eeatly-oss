import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SettingRow } from "@/components/settings/setting-row";
import { RouteSection } from "@/components/settings/route-section";
import { ThemeToggle } from "@/components/settings/theme-toggle";

export const metadata: Metadata = { title: "Settings · Appearance" };

export default function AppearanceSettingsPage() {
  return (
    <RouteSection title="Appearance" lede="How eeatly looks on this device.">
      <Card className="overflow-hidden p-0">
        <SettingRow
          label="Theme"
          sub="Light follows your editorial cream. Dark uses a warm near-black. System tracks your OS."
          suffix={<ThemeToggle />}
          last
        />
      </Card>
    </RouteSection>
  );
}
