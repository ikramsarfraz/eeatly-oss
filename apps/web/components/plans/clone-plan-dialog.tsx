"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { isUpgradeRequired } from "@/lib/trpc/errors";
import { bumpYearInName } from "@eeatly/shared";

export type ClonePlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: { id: string; name: string };
};

// Inner component so we can `key` it on (source.id, open) — that forces a
// re-mount whenever the source changes or the dialog re-opens, which is
// the cleanest way to reset the form pre-fill without a setState-in-effect.
function ClonePlanDialogBody({ onOpenChange, source }: Omit<ClonePlanDialogProps, "open">) {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = React.useState(() => bumpYearInName(source.name));
  const [date, setDate] = React.useState("");
  const cloneMutation = trpc.plans.cloneFromPast.useMutation();

  async function handleClone() {
    if (cloneMutation.isPending) return;
    if (!name.trim()) {
      showToast({ variant: "error", title: "Give the plan a name" });
      return;
    }
    if (!date) {
      showToast({
        variant: "error",
        title: "Pick a date for the new occasion"
      });
      return;
    }
    try {
      const result = await cloneMutation.mutateAsync({
        sourcePlanId: source.id,
        newName: name.trim(),
        newScheduledDate: date
      });
      onOpenChange(false);
      // Pass `hintsFrom=<sourceId>` so the new plan's detail page can
      // server-render hint badges even after refresh. The procedure
      // returns previousAnnotations directly, but the URL-bound source
      // makes hints survive refreshes / shared links until dismissed.
      router.push(`/plans/${result.newPlanId}?hintsFrom=${source.id}` as Route);
    } catch (error) {
      showToast({
        variant: "error",
        title: isUpgradeRequired(error) ? "Upgrade required" : "Couldn't clone plan",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Clone for next time</DialogTitle>
        <DialogDescription>
          Start the new plan with the same dishes. Past notes appear as hints
          on each dish — you can keep, modify, or remove any of them.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="clone-name">Name</Label>
          <Input
            id="clone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Original: {source.name}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="clone-date">Date</Label>
          <Input
            id="clone-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={cloneMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleClone} disabled={cloneMutation.isPending}>
          {cloneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Clone
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ClonePlanDialog({ open, onOpenChange, source }: ClonePlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Key on (source.id, open) re-mounts the body whenever the user opens
          the dialog or picks a different source — re-runs the state
          initializer (bumpYearInName, empty date) without a useEffect. */}
      <ClonePlanDialogBody
        key={`${source.id}:${open ? "open" : "closed"}`}
        onOpenChange={onOpenChange}
        source={source}
      />
    </Dialog>
  );
}
