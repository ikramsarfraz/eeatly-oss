"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/providers/toast-provider";

/**
 * R36 Library — per-recipe Archive / Delete (+ their inverses) with optimistic
 * removal and an Undo toast. Active-grid rows are hidden instantly via
 * `hiddenIds` (then reconciled by `router.refresh()`); the Archived view is a
 * tRPC query, so its rows reconcile by invalidation.
 */
export function useLibraryManagement() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const archiveMut = trpc.meals.archive.useMutation();
  const unarchiveMut = trpc.meals.unarchive.useMutation();
  const deleteMut = trpc.meals.delete.useMutation();
  const restoreMut = trpc.meals.restore.useMutation();

  // Ids removed from the active grid this session (pre-refresh).
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(() => new Set());
  const hide = (id: string) => setHiddenIds((s) => new Set(s).add(id));
  const unhide = (id: string) =>
    setHiddenIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  const refresh = React.useCallback(() => {
    router.refresh();
    void utils.meals.archivedList.invalidate();
  }, [router, utils]);

  /** Archive an active recipe → tucked into the Archived view; Undo restores it. */
  const archive = React.useCallback(
    (id: string, name: string) => {
      hide(id);
      archiveMut.mutate(
        { mealId: id },
        {
          onError: () => {
            unhide(id);
            showToast({ variant: "error", title: "Could not archive that recipe." });
          },
          onSuccess: () => {
            showToast({
              variant: "success",
              title: `"${name}" archived`,
              description: "Find it in the Archived view.",
              action: {
                label: "Undo",
                onClick: () =>
                  unarchiveMut.mutate(
                    { mealId: id },
                    { onSettled: () => (unhide(id), refresh()) }
                  )
              }
            });
            refresh();
          }
        }
      );
    },
    [archiveMut, unarchiveMut, refresh, showToast]
  );

  /** Soft-delete an active recipe; Undo restores it at its original spot. */
  const remove = React.useCallback(
    (id: string, name: string) => {
      hide(id);
      deleteMut.mutate(
        { mealId: id },
        {
          onError: () => {
            unhide(id);
            showToast({ variant: "error", title: "Could not delete that recipe." });
          },
          onSuccess: () => {
            showToast({
              variant: "success",
              title: `"${name}" deleted`,
              action: {
                label: "Undo",
                onClick: () =>
                  restoreMut.mutate(
                    { mealId: id },
                    { onSettled: () => (unhide(id), refresh()) }
                  )
              }
            });
            refresh();
          }
        }
      );
    },
    [deleteMut, restoreMut, refresh, showToast]
  );

  /** Restore an archived recipe back to the active library. */
  const restore = React.useCallback(
    (id: string, name: string) => {
      unarchiveMut.mutate(
        { mealId: id },
        {
          onError: () => showToast({ variant: "error", title: "Could not restore that recipe." }),
          onSuccess: () => {
            showToast({ variant: "success", title: `"${name}" restored` });
            refresh();
          }
        }
      );
    },
    [unarchiveMut, refresh, showToast]
  );

  /** Permanently (soft) delete from the Archived view; Undo brings it back archived. */
  const removePermanent = React.useCallback(
    (id: string, name: string) => {
      deleteMut.mutate(
        { mealId: id },
        {
          onError: () =>
            showToast({ variant: "error", title: "Could not delete that recipe." }),
          onSuccess: () => {
            showToast({
              variant: "success",
              title: `"${name}" deleted`,
              action: {
                label: "Undo",
                onClick: () =>
                  restoreMut.mutate({ mealId: id }, { onSettled: refresh })
              }
            });
            refresh();
          }
        }
      );
    },
    [deleteMut, restoreMut, refresh, showToast]
  );

  return { hiddenIds, archive, remove, restore, removePermanent };
}
