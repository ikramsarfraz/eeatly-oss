import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { SearchMobile } from "@/components/mobile/search-mobile";

export const metadata: Metadata = {
  title: "Search"
};

export const dynamic = "force-dynamic";

/**
 * R35 — Search as a screen. The desktop command palette stays the quick
 * keyboard search; this route is the mobile-web full-screen search (and a
 * centered desktop fallback) over the same `trpc.search.meals` query.
 */
export default async function SearchPage() {
  await requireCurrentUserWithHousehold();
  return <SearchMobile />;
}
