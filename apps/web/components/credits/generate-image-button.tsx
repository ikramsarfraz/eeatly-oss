"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { AI_CREDIT_COSTS } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

const COST = AI_CREDIT_COSTS.dish_image;

type GenerateImageButtonProps = {
  mealId: string;
  /** Called with the generated (or reused) image URL on success. */
  onGenerated: (imageUrl: string) => void;
  className?: string;
};

/**
 * The one AI action whose cost gets surfaced in-flow: dish-image generation is
 * 10 credits (10× the cheap ops), so it carries an explicit badge + an
 * always-on confirm ("uses 10 credits — you'll have N left"). The cheap ops
 * stay label-free and lean on the aggregate `CreditUsageBar`.
 *
 * Spend is optimistic (the bar's balance decrements immediately) with rollback
 * on error; the server is the source of truth via `onSettled` invalidation.
 */
export function GenerateImageButton({ mealId, onGenerated, className }: GenerateImageButtonProps) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [open, setOpen] = React.useState(false);

  const balanceQuery = trpc.credits.balance.useQuery();
  const balance = balanceQuery.data;
  const insufficient = balance ? balance.total < COST : false;
  const afterSpend = balance ? Math.max(0, balance.total - COST) : null;
  const isFree = balance?.tier === "free";

  const generate = trpc.ai.generateDishImage.useMutation({
    onMutate: async () => {
      await utils.credits.balance.cancel();
      const previous = utils.credits.balance.getData();
      if (previous) {
        utils.credits.balance.setData(undefined, {
          ...previous,
          total: Math.max(0, previous.total - COST),
          monthlyRemaining: Math.max(0, previous.monthlyRemaining - COST)
        });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) utils.credits.balance.setData(undefined, context.previous);
      const reason = getCause(error)?.reason;
      showToast({
        variant: "error",
        title: reason === "INSUFFICIENT_CREDITS" ? "Not enough credits" : "Couldn't generate image",
        description:
          reason === "INSUFFICIENT_CREDITS"
            ? `You need ${COST} credits. Top up in Settings to generate.`
            : error instanceof Error
              ? error.message
              : "Please try again."
      });
    },
    onSuccess: (res) => {
      if (res.imageUrl) {
        onGenerated(res.imageUrl);
      } else {
        showToast({
          variant: "error",
          title: "Couldn't generate image",
          description: "The image service didn't return anything. No credits were spent."
        });
      }
    },
    onSettled: () => {
      void utils.credits.balance.invalidate();
    }
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("min-h-[40px]", className)}
        disabled={generate.isPending}
        onClick={() => setOpen(true)}
      >
        {generate.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        Generate image
        <span className="ml-1 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
          {COST}
        </span>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate an AI dish image?</AlertDialogTitle>
            <AlertDialogDescription>
              {insufficient ? (
                <>
                  This uses <strong>{COST} credits</strong>, but you have{" "}
                  {balance?.total ?? 0}. Top up to generate one.
                </>
              ) : (
                <>
                  This uses <strong>{COST} credits</strong>
                  {afterSpend !== null ? (
                    <>
                      {" "}
                      — you&apos;ll have <strong>{afterSpend.toLocaleString()}</strong> left
                    </>
                  ) : null}
                  .
                  {isFree ? " That's 10 of your 40 free monthly credits." : ""}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {insufficient ? (
              <AlertDialogAction asChild>
                <Link href={"/settings/plan#credits" as Route}>Top up</Link>
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={() => generate.mutate({ mealId })}>
                Generate · {COST} credits
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
