import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SettingRow } from "@/components/settings/setting-row";
import { RouteSection } from "@/components/settings/route-section";

export const metadata: Metadata = { title: "Settings · Notifications" };

export default function NotificationsSettingsPage() {
  return (
    <RouteSection title="Notifications" lede="Alerts for your kitchen.">
      <Card className="overflow-hidden p-0">
        <SettingRow
          label="Coming soon"
          sub="Alerts when co-cooks log meals, plans approach, and pending invites expire."
          last
        />
      </Card>
    </RouteSection>
  );
}
