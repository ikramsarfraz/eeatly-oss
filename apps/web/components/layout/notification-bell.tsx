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
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/services/notifications";

/**
 * Round 11 — bell reads via `trpc.notifications.list.useQuery`. The
 * two mark-as-read actions are still server actions until Task 3
 * migrates them; on success we invalidate the tRPC query to refetch
 * unread counts.
 *
 * `refetchOnWindowFocus` is true on this one query so the badge stays
 * honest if the user lets the tab sit open. (Round 6 cache defaults
 * disable focus refetch globally; we opt back in here because it's
 * cheap and the badge is high-visibility.)
 */
export function NotificationBell() {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const utils = trpc.useUtils();
  const markRead = trpc.notifications.markRead.useMutation();
  const markAllRead = trpc.notifications.markAllRead.useMutation();

  const { data, isFetching, refetch } = trpc.notifications.list.useQuery(
    undefined,
    {
      staleTime: 30_000,
      refetchOnWindowFocus: true
    }
  );

  // Re-fetch when the dropdown opens — the badge could be stale and
  // we'd rather pay one tRPC call than show outdated counts.
  React.useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const rows = data?.rows ?? [];
  const unread = data?.unreadCount ?? 0;
  const loaded = data !== undefined;

  function handleItemClick(notification: NotificationDTO) {
    if (notification.readAt) return;
    startTransition(async () => {
      try {
        await markRead.mutateAsync({ notificationId: notification.id });
        // Optimistic local mutation via tRPC's cache helper, then
        // invalidate so the server's source of truth wins on the
        // next render pass.
        utils.notifications.list.setData(undefined, (prev) =>
          prev
            ? {
                rows: prev.rows.map((n) =>
                  n.id === notification.id ? { ...n, readAt: new Date() } : n
                ),
                unreadCount: Math.max(0, prev.unreadCount - 1)
              }
            : prev
        );
        await utils.notifications.list.invalidate();
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
    if (unread === 0) return;
    startTransition(async () => {
      try {
        await markAllRead.mutateAsync();
        const readAt = new Date();
        utils.notifications.list.setData(undefined, (prev) =>
          prev
            ? {
                rows: prev.rows.map((n) => ({ ...n, readAt: n.readAt ?? readAt })),
                unreadCount: 0
              }
            : prev
        );
        await utils.notifications.list.invalidate();
      } catch (error) {
        showToast({
          variant: "error",
          title: "Couldn't mark all as read",
          description: error instanceof Error ? error.message : "Please try again."
        });
      }
    });
  }

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
              className="absolute right-1 top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-accent px-[4px] text-[10px] font-semibold leading-none text-accent-foreground"
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
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              {loaded && !isFetching
                ? "You're all caught up. Notifications will appear here."
                : "Loading…"}
            </p>
          ) : (
            rows.map((n) => (
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

/** The sharing-notification kind tag, read from `payload.kind`. */
const TAG_STYLES: Record<string, { label: string; className: string }> = {
  share: { label: "Shared", className: "bg-[color:var(--sage-soft)] text-[color:var(--primary)]" },
  update: { label: "Updated", className: "bg-[color:var(--wheat-soft)] text-[color:var(--wheat-fg)]" },
  request: { label: "Request", className: "bg-[color:var(--terra-soft)] text-[color:var(--terra,#c66b47)]" },
  connection_invite: { label: "Invite", className: "bg-[var(--surface-2)] text-muted-foreground" }
};

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

  const kind = typeof notification.payload?.kind === "string" ? notification.payload.kind : null;
  const tag = kind ? TAG_STYLES[kind] : undefined;
  const requestId =
    kind === "request" && typeof notification.payload?.requestId === "string"
      ? notification.payload.requestId
      : null;

  const content = (
    <div
      className={cn(
        "grid gap-1.5 px-3 py-3 transition-colors hover:bg-[var(--surface-2)]",
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
      <div className="flex items-center gap-2">
        {tag ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase",
              tag.className
            )}
            style={{ letterSpacing: "0.08em" }}
          >
            {tag.label}
          </span>
        ) : null}
        <span className="text-[11px] text-muted-foreground">{created}</span>
      </div>
      {requestId ? <RequestActions requestId={requestId} notificationId={notification.id} /> : null}
    </div>
  );

  // Request notifications carry inline action buttons, so never wrap them
  // in a navigating Link or an outer button (no nested interactives).
  if (requestId) {
    return (
      <div className="block w-full border-b border-border text-left last:border-b-0">
        {content}
      </div>
    );
  }
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

/** Share it / Not now actions for a Request notification. */
function RequestActions({
  requestId,
  notificationId
}: {
  requestId: string;
  notificationId: string;
}) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [done, setDone] = React.useState<"granted" | "declined" | null>(null);

  const resolve = trpc.sharing.resolveRequest.useMutation({
    onSuccess: (_d, vars) => {
      setDone(vars.action === "grant" ? "granted" : "declined");
      void utils.notifications.list.invalidate();
      void utils.sharing.grantsForItem.invalidate();
      showToast({
        variant: "success",
        title: vars.action === "grant" ? "Shared" : "Declined"
      });
      void notificationId;
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't resolve", description: e.message })
  });

  if (done) {
    return (
      <p className="text-[11.5px] font-medium text-muted-foreground">
        {done === "granted" ? "You shared it." : "Declined."}
      </p>
    );
  }

  return (
    <div className="mt-0.5 flex items-center gap-2">
      <button
        type="button"
        disabled={resolve.isPending}
        onClick={() => resolve.mutate({ requestId, action: "grant" })}
        className="rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--primary-foreground)] disabled:opacity-50"
      >
        Share it
      </button>
      <button
        type="button"
        disabled={resolve.isPending}
        onClick={() => resolve.mutate({ requestId, action: "decline" })}
        className="rounded-full border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-[var(--surface-2)] disabled:opacity-50"
      >
        Not now
      </button>
    </div>
  );
}
