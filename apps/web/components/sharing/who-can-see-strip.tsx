"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Copy, Lock, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/sharing/share-sheet";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * "Who can see this" strip — a full-width bar on recipe/plan detail that
 * surfaces the item's sharing state and entry to the Share sheet.
 *
 * Three states:
 *   - Owner, private  → lock + "Only you can see this" + Share.
 *   - Owner, shared   → people + avatar/count + "Manage sharing".
 *   - Grantee (live)  → read-only "Shared by <owner> · Live · View only"
 *                       + Save a copy (recipes only).
 */
export function WhoCanSeeStrip({
  itemType,
  itemId,
  itemName,
  isOwner,
  ownerName,
  savedCopyItemId
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  itemName: string;
  isOwner: boolean;
  /** Owner's display name — for the grantee read-only variant. */
  ownerName?: string | null;
  /** If the grantee already forked this, the copy's id (recipes). */
  savedCopyItemId?: string | null;
}) {
  if (isOwner) {
    return <OwnerStrip itemType={itemType} itemId={itemId} itemName={itemName} />;
  }
  return (
    <GranteeStrip
      itemType={itemType}
      itemId={itemId}
      itemName={itemName}
      ownerName={ownerName ?? null}
      savedCopyItemId={savedCopyItemId ?? null}
    />
  );
}

const STRIP =
  "flex flex-wrap items-center gap-4 border-y border-[var(--border)] bg-[var(--paper,var(--surface-2))] px-7 py-4 sm:px-9";

function OwnerStrip({
  itemType,
  itemId,
  itemName
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  itemName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const grantsQuery = trpc.sharing.grantsForItem.useQuery({ itemType, itemId });
  const grants = grantsQuery.data ?? [];
  const shared = grants.length > 0;

  // Grants are already fetched above; warm the remaining sheet queries
  // (people + link state) on hover/focus so the sheet opens populated.
  const utils = trpc.useUtils();
  const prefetchShare = React.useCallback(() => {
    void utils.sharing.connections.prefetch(undefined, { staleTime: 30_000 });
    if (itemType === "recipe") {
      void utils.shares.activeForMeal.prefetch({ mealId: itemId }, { staleTime: 30_000 });
    } else {
      void utils.shares.activeForPlan.prefetch({ planId: itemId }, { staleTime: 30_000 });
    }
  }, [utils, itemType, itemId]);

  const names = grants
    .map((g) => g.name?.trim() || g.email.split("@")[0])
    .slice(0, 2)
    .join(", ");
  const extra = grants.length > 2 ? ` +${grants.length - 2}` : "";

  return (
    <>
      <div className={STRIP}>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
            shared
              ? "bg-[color:var(--sage-soft)] text-[color:var(--primary)]"
              : "bg-[var(--surface-2)] text-muted-foreground"
          )}
        >
          {shared ? <Users className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          {shared ? (
            <>
              <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                Shared with {names}
                {extra}
                <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase text-[color:var(--primary)]">
                  <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[color:var(--forest-soft,var(--primary))]" />
                  Live
                </span>
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                They see your latest version. Your edits update their copy — they can&apos;t change
                yours.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-medium text-foreground">Only you can see this</p>
              <p className="text-[12.5px] text-muted-foreground">
                This {itemType} is private. Share it to give someone a live copy.
              </p>
            </>
          )}
        </div>
        <Button
          variant={shared ? "outline" : "default"}
          className="min-h-[40px]"
          onClick={() => setOpen(true)}
          onPointerEnter={prefetchShare}
          onFocus={prefetchShare}
        >
          {shared ? "Manage sharing" : "Share"}
        </Button>
      </div>
      <ShareSheet
        itemType={itemType}
        itemId={itemId}
        itemName={itemName}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => void grantsQuery.refetch()}
      />
    </>
  );
}

function GranteeStrip({
  itemType,
  itemId,
  ownerName,
  itemName,
  savedCopyItemId
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  itemName: string;
  ownerName: string | null;
  savedCopyItemId: string | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [savedId, setSavedId] = React.useState<string | null>(savedCopyItemId);
  const [shareOpen, setShareOpen] = React.useState(false);
  // The owner may permit re-sharing ("cooks can re-share"); only then does a
  // grantee get a Share affordance.
  const canReshare = trpc.sharing.canReshare.useQuery({ itemType, itemId });
  const save = trpc.sharing.saveCopy.useMutation({
    onSuccess: (res) => {
      setSavedId(res.newItemId);
      showToast({ variant: "success", title: "Saved to your library" });
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't save copy", description: e.message })
  });
  const copyHref = (id: string): Route =>
    itemType === "recipe" ? (`/meal/${id}` as Route) : (`/plans/${id}` as Route);

  return (
    <div className={STRIP}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--sage-soft)] text-[color:var(--primary)]">
        <Users className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
          Shared by {ownerName ?? "someone"}
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase text-[color:var(--primary)]">
            <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[color:var(--forest-soft,var(--primary))]" />
            Live
          </span>
          <span className="font-mono text-[9.5px] uppercase text-muted-foreground">· View only</span>
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          You see their latest version as they edit. Save a copy to make it your own.
        </p>
      </div>
      {canReshare.data ? (
        <Button variant="outline" className="min-h-[40px]" onClick={() => setShareOpen(true)}>
          <Users className="h-3.5 w-3.5" />
          Share
        </Button>
      ) : null}
      {savedId ? (
        <Button variant="outline" className="min-h-[40px]" onClick={() => router.push(copyHref(savedId))}>
          <Copy className="h-3.5 w-3.5" />
          Open my copy
        </Button>
      ) : (
        <Button
          variant="default"
          className="min-h-[40px]"
          disabled={save.isPending}
          onClick={() => save.mutate({ itemType, itemId })}
        >
          <Copy className="h-3.5 w-3.5" />
          Save a copy
        </Button>
      )}
      {canReshare.data ? (
        <ShareSheet
          itemType={itemType}
          itemId={itemId}
          itemName={itemName}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}
    </div>
  );
}
