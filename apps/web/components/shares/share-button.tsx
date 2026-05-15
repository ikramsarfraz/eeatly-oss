"use client";

import * as React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShareLinkDialog } from "@/components/shares/share-link-dialog";

type ShareButtonProps = {
  mealId: string;
  mealName: string;
  /**
   * "icon" — small icon-only button for dish rows / recent-meal tiles
   *   where the share affordance shouldn't dominate.
   * "default" — standard sized button for explicit share surfaces
   *   (future /meal/[id] page).
   */
  variant?: "icon" | "default";
  className?: string;
};

/**
 * Round 7 — small reusable trigger that owns its own dialog-open state.
 * Embed anywhere a meal id is known; the underlying share-link service
 * is idempotent so re-clicking on the same meal is safe.
 */
export function ShareButton({
  mealId,
  mealName,
  variant = "icon",
  className
}: ShareButtonProps) {
  const [open, setOpen] = React.useState(false);

  if (variant === "icon") {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          aria-label={`Share "${mealName}"`}
          className={cn("text-muted-foreground hover:text-foreground", className)}
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>
        <ShareLinkDialog
          open={open}
          onOpenChange={setOpen}
          mealId={mealId}
          mealName={mealName}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <ShareLinkDialog
        open={open}
        onOpenChange={setOpen}
        mealId={mealId}
        mealName={mealName}
      />
    </>
  );
}
