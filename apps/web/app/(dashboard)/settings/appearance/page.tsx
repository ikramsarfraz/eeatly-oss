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
          sub="Light is the default, your editorial cream. Switch to Dark for a warm near-black anytime."
          suffix={<ThemeToggle />}
          last
        />
      </Card>
    </RouteSection>
  );
}
