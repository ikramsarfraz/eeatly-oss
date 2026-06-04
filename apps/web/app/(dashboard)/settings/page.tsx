import type { Route } from "next";
import { redirect } from "next/navigation";

/** Bare `/settings` → the default section. */
export default function SettingsIndexPage() {
  redirect("/settings/account" as Route);
}
