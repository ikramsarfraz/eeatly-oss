"use client";

import * as React from "react";
import { CheckCircle2, Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
import { generateShareAction } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import type { ShareActionResult } from "@/types";

type ShareRecipeDialogProps = {
  mealId: string;
  mealName: string;
  onOpenLogForm: (mealName: string) => void;
};

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "recipe"; text: string }
  | { phase: "missing" }
  | { phase: "error"; message: string };

export function ShareRecipeDialog({ mealId, mealName, onOpenLogForm }: ShareRecipeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<State>({ phase: "idle" });
  const [copied, setCopied] = React.useState(false);
  const { showToast } = useToast();

  async function generate() {
    setState({ phase: "loading" });
    let result: ShareActionResult;
    try {
      result = await generateShareAction(mealId);
    } catch {
      setState({ phase: "error", message: "Something went wrong. Please try again." });
      return;
    }

    if (result.ok) {
      setState({ phase: "recipe", text: result.text });
    } else if (result.code === "RECIPE_MISSING") {
      setState({ phase: "missing" });
    } else {
      setState({ phase: "error", message: result.message });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && state.phase === "idle") {
      void generate();
    }
    if (!nextOpen) {
      setState({ phase: "idle" });
      setCopied(false);
    }
  }

  async function handleCopy() {
    if (state.phase !== "recipe") return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      showToast({ variant: "success", title: "Copied — paste into WhatsApp" });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast({ variant: "error", title: "Copy failed", description: "Please select and copy the text manually." });
    }
  }

  function handleAddRecipe() {
    setOpen(false);
    onOpenLogForm(mealName);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="sr-only">Share recipe</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share recipe</DialogTitle>
          <DialogDescription>{mealName}</DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {state.phase === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Writing recipe…</span>
          </div>
        )}

        {/* Recipe ready */}
        {state.phase === "recipe" && (
          <div className="grid gap-3">
            <div className="max-h-[320px] overflow-y-auto rounded-lg border bg-muted p-4">
              <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground font-sans">
                {state.text}
              </pre>
            </div>

            <Button onClick={handleCopy} className="w-full gap-2">
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to clipboard
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void generate()}
              className="w-full gap-1.5 text-muted-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate (uses 1 AI call)
            </Button>
          </div>
        )}

        {/* No recipe saved */}
        {state.phase === "missing" && (
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              This meal doesn&apos;t have a recipe saved yet. Add one the next time you log it.
            </p>
            <Button onClick={handleAddRecipe} className="w-full">
              Open log form
            </Button>
          </div>
        )}

        {/* Error */}
        {state.phase === "error" && (
          <div className="grid gap-4 py-2">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" onClick={() => void generate()} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
