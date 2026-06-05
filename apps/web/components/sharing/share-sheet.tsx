"use client";

import * as React from "react";
import { Copy, Link2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";

type Role = "view" | "edit" | "admin";

/**
 * Reusable Share sheet — share one item with specific people + an optional
 * read-only link. Used from the Library cards and the recipe/plan "who can
 * see this" strips. Granting/revoking is per-person and immediate; the
 * parent re-reads sharing state on close via `onChanged`.
 *
 * Layout (sharing-IA direction C): an add row at the top (search an
 * eligible person + role + Share), then "People with access" (owner +
 * grantees with a role select + Remove), a one-line role hint, and the
 * "anyone with the link" row folded in at the bottom. Eligible targets are
 * the viewer's share circle PLUS kitchen-mates — recipes are private by
 * default, so a kitchen-mate is a normal per-item target here.
 */
export function ShareSheet({
  itemType,
  itemId,
  itemName,
  open,
  onOpenChange,
  onChanged
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  // staleTime keeps data the trigger prefetched (on hover) — and the strip's
  // own grants query — fresh, so the sheet paints populated immediately
  // instead of flashing the empty/off default while it refetches.
  const peopleQuery = trpc.sharing.connections.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000
  });
  const grantsQuery = trpc.sharing.grantsForItem.useQuery(
    { itemType, itemId },
    { enabled: open, staleTime: 30_000 }
  );

  const refresh = () => {
    void utils.sharing.grantsForItem.invalidate({ itemType, itemId });
    onChanged?.();
  };

  const grant = trpc.sharing.grant.useMutation({
    onSuccess: refresh,
    onError: (e) => showToast({ variant: "error", title: "Couldn't share", description: e.message })
  });
  const setRole = trpc.sharing.setRole.useMutation({
    onSuccess: refresh,
    onError: (e) => showToast({ variant: "error", title: "Couldn't update role", description: e.message })
  });
  const revoke = trpc.sharing.revoke.useMutation({
    onSuccess: (_d, vars) => {
      refresh();
      const person = grantsQuery.data?.find((g) => g.granteeUserId === vars.granteeUserId);
      showToast({
        variant: "success",
        title: `${person?.name?.trim() || "Their"} access removed`,
        description: "Their live copy is gone. A copy they saved stays theirs."
      });
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't update", description: e.message })
  });

  const busy = grant.isPending || revoke.isPending || setRole.isPending;

  // People who already have access (grantees), and the eligible people you
  // could still add (share circle + kitchen-mates, minus the ones already in).
  const granted = grantsQuery.data ?? [];
  const grantedIds = new Set(granted.map((g) => g.granteeUserId));
  const eligible = (peopleQuery.data ?? []).filter((p) => !grantedIds.has(p.userId));

  // Add-row state.
  const [addText, setAddText] = React.useState("");
  const [addRole, setAddRole] = React.useState<Role>("view");
  const q = addText.trim().toLowerCase();
  const matches = q
    ? eligible.filter(
        (p) =>
          (p.name?.toLowerCase().includes(q) ?? false) || p.email.toLowerCase().includes(q)
      )
    : [];

  const addPerson = (userId: string) => {
    grant.mutate({ itemType, itemId, granteeUserId: userId, role: addRole });
    setAddText("");
  };
  const changeRole = (userId: string, role: Role) =>
    setRole.mutate({ itemType, itemId, granteeUserId: userId, role });

  const accessCount = granted.length + 1; // grantees + the owner (you)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <p
            className="font-mono text-[10.5px] uppercase text-[color:var(--terra-fg)]"
            style={{ letterSpacing: "0.16em" }}
          >
            Share · {itemType}
          </p>
          <DialogTitle className="font-serif text-[28px]">
            Share <span className="italic">{itemName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-w-0 gap-4">
          {/* Add row — search an eligible person, pick a role, Share. */}
          <div className="grid min-w-0 gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[12px] border px-2.5 py-1.5">
              <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                placeholder="Search people to add…"
                aria-label="Add a person"
                className="min-w-[140px] flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <select
                aria-label="Access level for new people"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as Role)}
                className="rounded-[8px] border bg-[var(--surface)] px-2 py-1 text-[12px] font-medium text-foreground"
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                variant="default"
                size="sm"
                disabled={busy || matches.length === 0}
                onClick={() => matches[0] && addPerson(matches[0].userId)}
              >
                Share
              </Button>
            </div>

            {/* Matches while typing — click to add. */}
            {q && matches.length > 0 ? (
              <ul className="grid gap-0.5 rounded-[12px] border bg-[var(--surface)] p-1">
                {matches.slice(0, 6).map((p) => {
                  const label = p.name?.trim() || p.email;
                  return (
                    <li key={p.userId}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => addPerson(p.userId)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--surface-2)]"
                      >
                        <Initial label={label} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-foreground">
                            {label}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {p.email}
                          </span>
                        </span>
                        <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : q ? (
              <p className="px-1 text-[12px] text-muted-foreground">
                No one matches &ldquo;{addText.trim()}&rdquo;. Invite new people from the{" "}
                <span className="font-medium text-foreground">People</span> page.
              </p>
            ) : eligible.length === 0 && granted.length === 0 ? (
              <p className="px-1 text-[12px] text-muted-foreground">
                No one to share with yet. Invite people from the{" "}
                <span className="font-medium text-foreground">People</span> page first.
              </p>
            ) : null}
          </div>

          {/* People with access — owner + grantees. */}
          <div className="grid min-w-0 gap-1">
            <p
              className="font-mono text-[10.5px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              People with access · {accessCount}
            </p>
            <ul className="grid">
              <li className="flex items-center gap-3 py-2.5">
                <Initial label="You" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                    You <RolePill role="owner" />
                  </span>
                </span>
                <span
                  className="font-mono text-[10px] uppercase text-muted-foreground"
                  style={{ letterSpacing: "0.1em" }}
                >
                  Only you can delete
                </span>
              </li>
              {granted.map((g) => {
                const label = g.name?.trim() || g.email;
                return (
                  <li
                    key={g.granteeUserId}
                    className="flex min-w-0 items-center gap-3 border-t border-[var(--border-soft,var(--border))] py-2.5"
                  >
                    <Initial label={label} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">
                        {label}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {g.email}
                      </span>
                    </span>
                    <select
                      aria-label={`${label}'s access level`}
                      value={g.role}
                      disabled={busy}
                      onChange={(e) => changeRole(g.granteeUserId, e.target.value as Role)}
                      className="rounded-[8px] border bg-[var(--surface)] px-2 py-1 text-[12.5px] font-medium text-foreground"
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => revoke.mutate({ itemType, itemId, granteeUserId: g.granteeUserId })}
                      className="font-mono text-[10.5px] uppercase text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      style={{ letterSpacing: "0.1em" }}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="pt-1 text-[12px] leading-[1.5] text-muted-foreground">
              <strong className="text-foreground">View</strong> reads ·{" "}
              <strong className="text-foreground">Edit</strong> changes the {itemType} in place ·{" "}
              <strong className="text-foreground">Admin</strong> also manages who has access.
            </p>
          </div>

          {/* Anyone-with-the-link row. */}
          {itemType === "recipe" ? (
            <RecipeLinkSection mealId={itemId} />
          ) : (
            <PlanLinkSection planId={itemId} />
          )}

          <div className="flex items-center justify-end border-t border-[var(--border-soft,var(--border))] pt-3">
            <Button variant="default" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Avatar monogram — first letter of name/email. */
function Initial({ label }: { label: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] font-serif text-[15px] text-foreground">
      {(label.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Small uppercase role tag (owner / admin / edit). */
function RolePill({ role }: { role: "owner" | "admin" | "edit" }) {
  return (
    <span
      className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-foreground"
      style={{ letterSpacing: "0.08em" }}
    >
      {role}
    </span>
  );
}

/** Recipe "anyone with the link" — reuses recipe_shares. */
function RecipeLinkSection({ mealId }: { mealId: string }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const activeQuery = trpc.shares.activeForMeal.useQuery(
    { mealId },
    { staleTime: 30_000 }
  );
  const active = activeQuery.data ?? null;
  const refresh = () => void utils.shares.activeForMeal.invalidate({ mealId });
  const create = trpc.shares.create.useMutation({
    onSuccess: refresh,
    onError: (e) => showToast({ variant: "error", title: "Couldn't create link", description: e.message })
  });
  const revoke = trpc.shares.revoke.useMutation({ onSuccess: refresh });
  return (
    <LinkToggle
      url={active?.url ?? null}
      busy={create.isPending || revoke.isPending}
      // `on` is the NEW switch state: turning on creates a link, turning off
      // revokes the active one.
      onToggle={(on) => {
        if (on) create.mutate({ mealId });
        else if (active) revoke.mutate({ shareId: active.shareId });
      }}
    />
  );
}

/** Plan "anyone with the link" — reuses plan_shares. */
function PlanLinkSection({ planId }: { planId: string }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const activeQuery = trpc.shares.activeForPlan.useQuery(
    { planId },
    { staleTime: 30_000 }
  );
  const active = activeQuery.data ?? null;
  const refresh = () => void utils.shares.activeForPlan.invalidate({ planId });
  const create = trpc.shares.createPlan.useMutation({
    onSuccess: refresh,
    onError: (e) => showToast({ variant: "error", title: "Couldn't create link", description: e.message })
  });
  const revoke = trpc.shares.revokePlan.useMutation({ onSuccess: refresh });
  return (
    <LinkToggle
      url={active?.url ?? null}
      busy={create.isPending || revoke.isPending}
      // `on` is the NEW switch state: turning on creates a link, turning off
      // revokes the active one.
      onToggle={(on) => {
        if (on) create.mutate({ planId });
        else if (active) revoke.mutate({ shareId: active.shareId });
      }}
    />
  );
}

/**
 * "Anyone with the link" — single row. When on, the URL + an inline Copy sit
 * beside the toggle (no duplicate Copy in the footer).
 */
function LinkToggle({
  url,
  busy,
  onToggle
}: {
  url: string | null;
  busy: boolean;
  onToggle: (on: boolean) => void;
}) {
  const { showToast } = useToast();
  const on = url !== null;
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[12px] border px-3 py-2.5">
      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-foreground">
          Anyone with the link{on ? " · on" : ""}
        </p>
        {on && url ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground">{url}</p>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            A read-only live view, no eeatly account needed.
          </p>
        )}
      </div>
      {on && url ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0"
          onClick={() => {
            void navigator.clipboard?.writeText(url);
            showToast({ variant: "success", title: "Link copied" });
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
      ) : null}
      <Switch
        aria-label="Anyone with the link"
        checked={on}
        disabled={busy}
        onCheckedChange={onToggle}
      />
    </div>
  );
}
