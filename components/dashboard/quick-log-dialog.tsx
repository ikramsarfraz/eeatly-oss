"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { MealLogForm } from "@/components/forms/meal-log-form";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

export function QuickLogDialog({
  canWrite,
  trigger
}: {
  canWrite: boolean;
  trigger?: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const [open, setOpen] = React.useState(false);

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4" />
      Quick log
    </Button>
  );

  if (!hydrated) {
    return <>{trigger ?? defaultTrigger}</>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a meal</DialogTitle>
          <DialogDescription>
            Add the thing you cooked, how much effort it took, and anything worth remembering.
          </DialogDescription>
        </DialogHeader>
        <MealLogForm canWrite={canWrite} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
