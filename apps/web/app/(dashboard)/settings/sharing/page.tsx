import type { Metadata } from "next";
import { RouteSection } from "@/components/settings/route-section";
import { SharingSection } from "@/components/settings/section-bodies";

export const metadata: Metadata = { title: "Settings · Sharing & privacy" };

export default function SharingSettingsPage() {
  return (
    <RouteSection
      title="Sharing & privacy"
      lede={
        <>
          eeatly is <strong className="text-foreground">private by default</strong>. Nothing you
          save is visible to anyone until you share it, one item at a time.
        </>
      }
    >
      <SharingSection />
    </RouteSection>
  );
}
