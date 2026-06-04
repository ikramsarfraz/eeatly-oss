import type { Metadata } from "next";
import { requireCurrentUserWithHousehold } from "@/lib/auth/session";
import {
  AddComposerClient,
  type CaptureMethod
} from "@/components/add/add-composer-client";

export const metadata: Metadata = {
  title: "Add to your kitchen"
};

export const dynamic = "force-dynamic";

const METHODS: CaptureMethod[] = ["log", "photo", "text", "voice", "link"];

/**
 * Unified capture composer — the single capture door. `?method=` deep-links
 * a specific tab (used by the redirects from the retired /add/log + /add/ai
 * routes, and by keyboard shortcuts). `?name=` pre-fills the log meal name
 * (Home's quick-log).
 */
export default async function AddPage(props: {
  searchParams: Promise<{ method?: string; name?: string }>;
}) {
  await requireCurrentUserWithHousehold();
  const { method, name } = await props.searchParams;
  const initialMethod = METHODS.includes(method as CaptureMethod)
    ? (method as CaptureMethod)
    : "log";
  return <AddComposerClient initialMethod={initialMethod} initialMealName={name} />;
}
