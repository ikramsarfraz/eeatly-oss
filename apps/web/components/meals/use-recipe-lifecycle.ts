"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/providers/toast-provider";

/**
 * R37 — Archive / Delete a single recipe from its detail page (desktop +
 * mobile-web, off the same `RecipeDetailMeal` payload).
 *
 * Sibling to the library grid's `useLibraryManagement`, but with one
 * difference that drives the whole shape: the library hides a row in place
 * and stays on `/library`, whereas the detail view IS the recipe. A delete
 * makes `getMealDetail` return null (the page would 404 on refresh), so on
 * success we leave for `/library` and offer Undo from the toast there.
 *
 * Both actions are owner-only server-side (the service matches strictly on
 * the creator); callers gate the affordance on `meal.viewerIsCreator` so a
 * non-creator never sees a button that would only ever 404.
 */
export function useRecipeLifecycle(mealId: string, mealName: string) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const archiveMut = trpc.meals.archive.useMutation();
  const unarchiveMut = trpc.meals.unarchive.useMutation();
  const deleteMut = trpc.meals.delete.useMutation();
  const restoreMut = trpc.meals.restore.useMutation();

  // After an Undo lands the recipe back, refresh whatever server component we
  // navigated to (library / home) and the lazy Archived list query so the
  // restored recipe reappears. `router` + `utils` are app-global, so this is
  // safe to call after the detail page has unmounted.
  const reconcile = React.useCallback(() => {
    void utils.meals.archivedList.invalidate();
    router.refresh();
  }, [router, utils]);

  // The Undo runs from /library, after `router.push` has unmounted this hook.
  // A mutation's per-call `onSettled` won't fire post-unmount, but the promise
  // from `mutateAsync` still resolves — so reconcile off that instead.
  const undo = React.useCallback(
    (
      mutateAsync: (vars: { mealId: string }) => Promise<unknown>,
      failTitle: string
    ) =>
      () => {
        void mutateAsync({ mealId })
          .then(reconcile)
          .catch(() => showToast({ variant: "error", title: failTitle }));
      },
    [mealId, reconcile, showToast]
  );

  const archive = React.useCallback(() => {
    archiveMut.mutate(
      { mealId },
      {
        onError: () =>
          showToast({ variant: "error", title: "Could not archive that recipe." }),
        onSuccess: () => {
          showToast({
            variant: "success",
            title: `"${mealName}" archived`,
            description: "Find it in the Archived view.",
            action: {
              label: "Undo",
              onClick: undo(
                unarchiveMut.mutateAsync,
                "Could not restore that recipe."
              )
            }
          });
          router.push("/library" as Route);
        }
      }
    );
  }, [archiveMut, unarchiveMut, mealId, mealName, router, showToast, undo]);

  const remove = React.useCallback(() => {
    deleteMut.mutate(
      { mealId },
      {
        onError: () =>
          showToast({ variant: "error", title: "Could not delete that recipe." }),
        onSuccess: () => {
          showToast({
            variant: "success",
            title: `"${mealName}" deleted`,
            action: {
              label: "Undo",
              onClick: undo(
                restoreMut.mutateAsync,
                "Could not restore that recipe."
              )
            }
          });
          router.push("/library" as Route);
        }
      }
    );
  }, [deleteMut, restoreMut, mealId, mealName, router, showToast, undo]);

  return {
    archive,
    remove,
    isArchiving: archiveMut.isPending,
    isDeleting: deleteMut.isPending
  };
}
