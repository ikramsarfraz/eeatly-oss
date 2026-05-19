import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { AddHubClient } from "@/components/add/add-hub-client";

export const metadata: Metadata = {
  title: "Add a meal"
};

export const dynamic = "force-dynamic";

/**
 * Round 29 — Add hub. Server shell.
 *
 * Auth-gated landing page for the Capture group. Renders the three
 * primary capture entries (Log a meal / Capture with AI / Save a
 * link) plus the existing planning + invite tiles. No data fetch
 * needed for v1; the Recent-imports section is omitted (no backend
 * feed today).
 */
export default async function AddHubPage() {
  await requireCurrentUserWithHousehold();
  return <AddHubClient />;
}
