import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { LogMealClient } from "@/components/add/log-meal-client";

export const metadata: Metadata = {
  title: "Log a meal"
};

export const dynamic = "force-dynamic";

/**
 * Round 29 — Log a meal page. Server shell.
 *
 * Reads optional `?name=...` for prefill (Home's Quick log card uses
 * this) and hands off to the client. Auth check matches every other
 * dashboard route.
 */
export default async function LogMealPage(props: {
  searchParams: Promise<{ name?: string }>;
}) {
  await requireCurrentUserWithHousehold();
  const sp = await props.searchParams;
  const initialMealName = sp.name?.trim() || undefined;
  return <LogMealClient initialMealName={initialMealName} />;
}
