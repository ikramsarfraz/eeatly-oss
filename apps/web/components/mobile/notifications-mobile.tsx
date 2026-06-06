"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Bell, CalendarHeart, Gift, Mail, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";

type NotifType = "rediscovery" | "neglected_meal" | "weekly_recap" | "system" | "household_invitation";

/** Per-type icon + plaque tone. */
const TYPE_STYLE: Record<NotifType, { icon: React.ComponentType<{ className?: string }>; plaque: string }> = {
  rediscovery: { icon: Sparkles, plaque: "bg-secondary text-primary" },
  neglected_meal: { icon: CalendarHeart, plaque: "bg-[color:var(--warn-soft)] text-[color:var(--warn,#8a6a1c)]" },
  weekly_recap: { icon: Gift, plaque: "bg-[color:var(--accent-soft)] text-[color:var(--accent)]" },
  system: { icon: Bell, plaque: "border border-border bg-card text-foreground" },
  household_invitation: { icon: Mail, plaque: "bg-secondary text-primary" }
};

function timeAgo(iso: string | Date): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/**
 * R35 mobile-web Notifications timeline. Full-screen list over the existing
 * `trpc.notifications.*` backend (the desktop keeps its bell dropdown). Color
 * coded plaques by type, unread tint + terra dot, mono timestamps, mark-read.
 */
export function NotificationsMobile() {
  const data = useNotifications();
  return (
    <MobileScaffold>
      <MobileTopBar
        back
        title="Notifications"
        sub={data.unread > 0 ? `${data.unread} unread` : undefined}
        right={
          data.unread > 0 ? (
            <button
              type="button"
              onClick={() => data.markAllRead.mutate()}
              disabled={data.markAllRead.isPending}
              className="self-center font-mono text-[10px] uppercase tracking-[0.1em] text-primary disabled:opacity-50"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />
      <NotificationsBody data={data} />
    </MobileScaffold>
  );
}

/** Shared data hooks for both the mobile screen and the desktop /notifications view. */
function useNotifications() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const query = trpc.notifications.list.useQuery({ limit: 50 });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate()
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate()
  });
  const rows = query.data?.rows ?? [];
  const unread = query.data?.unreadCount ?? 0;
  const openRow = (n: (typeof rows)[number]) => {
    if (!n.readAt) markRead.mutate({ notificationId: n.id });
    if (n.href) router.push(n.href as Route);
  };
  return { query, rows, unread, markAllRead, openRow };
}

function NotificationsBody({ data }: { data: ReturnType<typeof useNotifications> }) {
  const { query, rows, openRow } = data;
  return (
    <>
      {query.isLoading ? (
        <div className="px-4 py-12 text-center text-[14px] text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Bell className="h-7 w-7 text-[color:var(--ink4)]" />
          <p className="text-[15px] font-medium text-foreground">You&apos;re all caught up</p>
          <p className="text-[13px] text-muted-foreground">New nudges and recaps will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((n) => {
            const style = TYPE_STYLE[n.type as NotifType] ?? TYPE_STYLE.system;
            const Icon = style.icon;
            const isUnread = !n.readAt;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openRow(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-[color:var(--surface-2)]",
                    isUnread && "bg-[color:var(--surface-2)]"
                  )}
                >
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]", style.plaque)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-0.01em] text-foreground">
                        {n.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink3)]">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{n.body}</span>}
                  </span>
                  {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Desktop /notifications view (centered card). The bell dropdown remains the
 * primary desktop affordance; this is the full-page equivalent reached from
 * the same route. Hidden below `md` (the mobile screen renders there).
 */
export function NotificationsDesktop() {
  const data = useNotifications();
  return (
    <div className="mx-auto max-w-2xl font-[family-name:var(--font-geist)]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-serif text-[32px] tracking-[-0.02em] text-foreground">Notifications</h1>
        {data.unread > 0 && (
          <button
            type="button"
            onClick={() => data.markAllRead.mutate()}
            disabled={data.markAllRead.isPending}
            className="text-[13px] font-medium text-primary disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <NotificationsBody data={data} />
      </div>
    </div>
  );
}
