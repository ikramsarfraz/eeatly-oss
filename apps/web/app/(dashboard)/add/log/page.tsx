import { redirect } from "next/navigation";
import type { Route } from "next";

export const dynamic = "force-dynamic";

/**
 * Retired — the standalone Log page is now the `log` tab of the unified
 * composer at /add. Redirect (preserving the `?name=` prefill).
 */
export default async function LogMealRedirect(props: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await props.searchParams;
  const target = name?.trim()
    ? `/add?method=log&name=${encodeURIComponent(name.trim())}`
    : "/add?method=log";
  redirect(target as Route);
}
