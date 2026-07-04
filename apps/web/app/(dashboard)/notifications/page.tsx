import type { Metadata } from "next";
import { loadHousehold } from "@/lib/auth/rls";
import {
  NotificationsMobile,
  NotificationsDesktop
} from "@/components/mobile/notifications-mobile";

export const metadata: Metadata = {
  title: "Notifications"
};

export const dynamic = "force-dynamic";

/**
 * R35 — full-screen Notifications. Primarily a mobile-web surface (the desktop
 * keeps its top-bar bell dropdown); the desktop view here is a centered card
 * over the same `trpc.notifications.*` backend. Auth gate only; the list is
 * fetched client-side so read-state mutations invalidate live.
 */
export default async function NotificationsPage() {
  await loadHousehold(async () => {});
  return (
    <>
      <NotificationsMobile />
      <div className="hidden md:block">
        <NotificationsDesktop />
      </div>
    </>
  );
}
