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

type QuickLogDialogProps = {
  trigger?: React.ReactNode;
  /** When provided, the dialog is fully controlled by the parent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialMealName?: string;
  autoFocusRecipe?: boolean;
};

export function QuickLogDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialMealName,
  autoFocusRecipe
}: QuickLogDialogProps) {
  const hydrated = useHydrated();
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4" />
      Quick log
    </Button>
  );

  if (!hydrated) {
    return isControlled ? null : <>{trigger ?? defaultTrigger}</>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a meal</DialogTitle>
          <DialogDescription>
            Add the thing you cooked, how much effort it took, and anything worth remembering.
          </DialogDescription>
        </DialogHeader>
        <MealLogForm
          onSuccess={() => setOpen(false)}
          initialMealName={initialMealName}
          autoFocusRecipe={autoFocusRecipe}
        />
      </DialogContent>
    </Dialog>
  );
}
