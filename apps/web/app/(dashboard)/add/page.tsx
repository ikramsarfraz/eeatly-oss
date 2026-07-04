import type { Metadata } from "next";
import { loadHousehold } from "@/lib/auth/rls";
import { AddAssistClient } from "@/components/assist/add-assist-client";

export const metadata: Metadata = {
  title: "Add a meal"
};

export const dynamic = "force-dynamic";

/**
 * Add a meal — the "Assist" capture surface. Manual entry is always shown; the
 * AI Assist Bar pours a photo / voice / text / link into the same fields.
 * `?name=` pre-fills the meal name (Home's quick-log handoff). The legacy
 * `?method=` deep-link is accepted but no longer selects a tab (AI is one bar).
 */
export default async function AddPage(props: {
  searchParams: Promise<{ method?: string; name?: string }>;
}) {
  await loadHousehold(async () => {});
  const { name } = await props.searchParams;
  return <AddAssistClient initialMealName={name} />;
}
