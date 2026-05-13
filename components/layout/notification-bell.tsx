"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction
} from "@/actions/notifications";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/services/notifications";

type BellState = {
  rows: NotificationDTO[];
  unreadCount: number;
  loaded: boolean;
};

export function NotificationBell() {
  const { showToast } = useToast();
  const [state, setState] = React.useState<BellState>({
    rows: [],
    unreadCount: 0,
    loaded: false
  });
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(async () => {
    try {
      const result = await listNotificationsAction();
      setState({
        rows: result.rows,
        unreadCount: result.unreadCount,
        loaded: true
      });
    } catch {
      // Soft-fail — bell stays at zero unread, the next open re-tries.
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Initial load + on-open refresh. Counts could go stale between opens,
  // so re-loading on open keeps the badge honest without polling.
  // load() is async and only sets state on the result — the lint rule's
  // "cascading renders" warning is reasonable in general but this is the
  // narrow case it's meant to allow.
  React.useEffect(() => {
    if (!state.loaded) void load();
  }, [load, state.loaded]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleItemClick(notification: NotificationDTO) {
    if (notification.readAt) return;
    startTransition(async () => {
      try {
        await markNotificationReadAction(notification.id);
        setState((prev) => ({
          ...prev,
          rows: prev.rows.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date() } : n
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
      } catch (error) {
        showToast({
          variant: "error",
          title: "Couldn't mark as read",
          description: error instanceof Error ? error.message : "Please try again."
        });
      }
    });
  }

  function handleMarkAll() {
    if (state.unreadCount === 0) return;
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction();
        const readAt = new Date();
        setState((prev) => ({
          ...prev,
          rows: prev.rows.map((n) => ({ ...n, readAt: n.readAt ?? readAt })),
          unreadCount: 0
        }));
      } catch (error) {
        showToast({
          variant: "error",
          title: "Couldn't mark all as read",
          description: error instanceof Error ? error.message : "Please try again."
        });
      }
    });
  }

  const unread = state.unreadCount;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-[var(--accent)] px-[4px] text-[10px] font-semibold leading-none text-white"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-32px))] p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-[13px] font-semibold">Notifications</span>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={unread === 0 || pending}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {state.rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              {state.loaded
                ? "You're all caught up. Notifications will appear here."
                : "Loading…"}
            </p>
          ) : (
            state.rows.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onClick={() => handleItemClick(n)}
              />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({
  notification,
  onClick
}: {
  notification: NotificationDTO;
  onClick: () => void;
}) {
  const unread = !notification.readAt;
  const created = formatDistanceToNow(
    typeof notification.createdAt === "string"
      ? parseISO(notification.createdAt)
      : notification.createdAt,
    { addSuffix: true }
  );

  const content = (
    <div
      className={cn(
        "grid gap-1 px-3 py-3 transition-colors hover:bg-[var(--surface-2)]",
        unread ? "bg-[var(--primary-soft)]/30" : ""
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-[1.3] text-foreground">
          {notification.title}
        </span>
        {unread ? (
          <span
            aria-hidden="true"
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
          />
        ) : null}
      </div>
      {notification.body ? (
        <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
          {notification.body}
        </p>
      ) : null}
      <span className="text-[11px] text-muted-foreground">{created}</span>
    </div>
  );

  if (notification.href) {
    return (
      <Link
        href={notification.href as Route}
        onClick={onClick}
        className="block border-b border-border last:border-b-0"
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full border-b border-border text-left last:border-b-0"
    >
      {content}
    </button>
  );
}
