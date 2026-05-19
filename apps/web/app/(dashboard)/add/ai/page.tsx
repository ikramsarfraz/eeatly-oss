import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { CaptureAiClient } from "@/components/add/capture-ai-client";

export const metadata: Metadata = {
  title: "Capture with AI"
};

export const dynamic = "force-dynamic";

/**
 * Round 29 — Capture with AI page. Server shell.
 *
 * Single-page mode-tab flow (Photo / Text / Voice / Link) backed by
 * the existing `ai.suggest*` procedures. On extraction success the
 * page swaps to a Review phase rendering `<MealLogForm>` pre-filled
 * with the meal name.
 */
export default async function CaptureAiPage() {
  await requireCurrentUserWithHousehold();
  return <CaptureAiClient />;
}
