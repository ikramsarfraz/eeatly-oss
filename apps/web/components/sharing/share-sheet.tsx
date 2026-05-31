"use client";

import * as React from "react";
import { Check, Link2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Reusable Share sheet — share one item with specific people + an optional
 * read-only link. Used from the Library cards and (Phase 4) the recipe/plan
 * "who can see this" strips. Granting/revoking is per-person and immediate;
 * the parent re-reads sharing state on close via `onChanged`.
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

  const peopleQuery = trpc.sharing.connections.useQuery(undefined, { enabled: open });
  const grantsQuery = trpc.sharing.grantsForItem.useQuery(
    { itemType, itemId },
    { enabled: open }
  );
  const hasAccess = new Set((grantsQuery.data ?? []).map((g) => g.granteeUserId));

  const refresh = () => {
    void utils.sharing.grantsForItem.invalidate({ itemType, itemId });
    onChanged?.();
  };

  const grant = trpc.sharing.grant.useMutation({
    onSuccess: refresh,
    onError: (e) => showToast({ variant: "error", title: "Couldn't share", description: e.message })
  });
  const revoke = trpc.sharing.revoke.useMutation({
    onSuccess: (_d, vars) => {
      refresh();
      const name = peopleQuery.data?.find((p) => p.userId === vars.granteeUserId);
      showToast({
        variant: "success",
        title: `${name?.name ?? "Their"} access removed`,
        description: "Their live copy is gone. A copy they saved stays theirs."
      });
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't update", description: e.message })
  });

  const togglePerson = (userId: string, on: boolean) => {
    if (on) grant.mutate({ itemType, itemId, granteeUserId: userId });
    else revoke.mutate({ itemType, itemId, granteeUserId: userId });
  };

  const sharedCount = hasAccess.size;
  const people = peopleQuery.data ?? [];

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

        <div className="grid gap-4">
          <div className="grid gap-1">
            <p
              className="font-mono text-[10.5px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              People in your kitchen
            </p>
            {people.length === 0 ? (
              <p className="py-3 text-[13px] text-muted-foreground">
                No one in your circle yet. Invite people from the{" "}
                <span className="font-medium text-foreground">People</span> page first.
              </p>
            ) : (
              <ul className="grid gap-1">
                {people.map((p) => {
                  const on = hasAccess.has(p.userId);
                  const label = p.name?.trim() || p.email;
                  return (
                    <li key={p.userId}>
                      <button
                        type="button"
                        disabled={grant.isPending || revoke.isPending}
                        onClick={() => togglePerson(p.userId, !on)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          on
                            ? "bg-[color:var(--sage-soft)]"
                            : "hover:bg-[var(--surface-2)]"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] font-serif text-[15px] text-foreground">
                          {(label[0] ?? "?").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-medium text-foreground">
                              {label}
                            </span>
                            {on ? (
                              <span className="rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-[color:var(--primary-foreground)]">
                                Has access
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {p.email}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                            on
                              ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                              : "border-[var(--border-strong,var(--border))] text-transparent"
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-[14px] bg-[color:var(--sage-soft)] px-4 py-3 text-[12.5px] leading-[1.5] text-[color:var(--sage-fg)]">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              People you add get a <strong>live copy</strong> in their &ldquo;Shared with you.&rdquo;
              When you edit <strong>{itemName}</strong>, their copy updates too — and they can&apos;t
              change yours. To make it their own, they save a copy.
            </p>
          </div>

          {itemType === "recipe" ? (
            <RecipeLinkSection mealId={itemId} />
          ) : (
            <PlanLinkSection planId={itemId} />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-soft,var(--border))] pt-3">
            <p className="text-[12.5px] text-muted-foreground">
              {sharedCount > 0
                ? `Shared with ${sharedCount} ${sharedCount === 1 ? "person" : "people"}.`
                : "Only you can see this."}
            </p>
            <Button variant="default" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Recipe "anyone with the link" — reuses recipe_shares. */
function RecipeLinkSection({ mealId }: { mealId: string }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const activeQuery = trpc.shares.activeForMeal.useQuery({ mealId });
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
      onToggle={(on) => {
        if (on && active) revoke.mutate({ shareId: active.shareId });
        else create.mutate({ mealId });
      }}
    />
  );
}

/** Plan "anyone with the link" — reuses plan_shares. */
function PlanLinkSection({ planId }: { planId: string }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const activeQuery = trpc.shares.activeForPlan.useQuery({ planId });
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
      onToggle={(on) => {
        if (on && active) revoke.mutate({ shareId: active.shareId });
        else create.mutate({ planId });
      }}
    />
  );
}

/** Presentational "Anyone with the link" toggle + copy. */
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
    <div className="grid gap-2">
      <p
        className="font-mono text-[10.5px] uppercase text-muted-foreground"
        style={{ letterSpacing: "0.14em" }}
      >
        Or share a link
      </p>
      <div className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-foreground">Anyone with the link</p>
          <p className="text-[12px] text-muted-foreground">
            A read-only live view — no eeatly account needed.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy}
          onClick={() => onToggle(!on)}
          className={cn(
            "relative h-6 w-[42px] shrink-0 rounded-full transition-colors",
            on ? "bg-[color:var(--primary)]" : "bg-[var(--border-strong,var(--border))]"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
              on ? "translate-x-[18px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
      {on && url ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url);
            showToast({ variant: "success", title: "Link copied" });
          }}
          className="justify-self-start font-mono text-[11px] text-[color:var(--primary)] underline-offset-2 hover:underline"
        >
          Copy link
        </button>
      ) : null}
    </div>
  );
}
