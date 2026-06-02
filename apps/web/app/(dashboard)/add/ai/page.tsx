import { redirect } from "next/navigation";
import type { Route } from "next";

export const dynamic = "force-dynamic";

/**
 * Retired — "Capture with AI" is now the Photo/Text/Voice/Link tabs of the
 * unified composer at /add. Redirect old links to the photo method.
 */
export default function CaptureAiRedirect() {
  redirect("/add?method=photo" as Route);
}
