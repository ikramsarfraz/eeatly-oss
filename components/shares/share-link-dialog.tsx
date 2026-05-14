"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { UpgradePrompt } from "@/components/pricing/upgrade-prompt";
import {
  createRecipeShareAction,
  getShareForMealAction,
  revokeRecipeShareAction
} from "@/actions/shares";

export type ShareLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealId: string;
  mealName: string;
};

type DialogState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "active"; shareId: string; url: string }
  | { kind: "upgrade_required" }
  | { kind: "error"; message: string };

function ShareLinkDialogBody({
  onOpenChange,
  mealId,
  mealName
}: Omit<ShareLinkDialogProps, "open">) {
  const { showToast } = useToast();
  const [state, setState] = React.useState<DialogState>({ kind: "loading" });
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);

  // Pre-fetch existing share state on mount. If a share exists we
  // skip straight to the "active" view; if not, the user sees the
  // "Create share link" CTA and the service round-trip only fires
  // on intent. No `useEffect` for prop-derived state (lint rule),
  // but a one-shot mount-effect for a network fetch is fine.
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getShareForMealAction({ mealId });
      if (cancelled) return;
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        return;
      }
      if (result.share) {
        setState({ kind: "active", shareId: result.share.shareId, url: result.share.url });
      } else {
        setState({ kind: "empty" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mealId]);

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createRecipeShareAction({ mealId });
      if (result.ok) {
        setState({ kind: "active", shareId: result.shareId, url: result.url });
        return;
      }
      if (result.code === "UPGRADE_REQUIRED") {
        setState({ kind: "upgrade_required" });
        return;
      }
      setState({ kind: "error", message: result.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast({
        variant: "error",
        title: "Couldn't copy",
        description: "Long-press the link to copy manually."
      });
    }
  }

  async function handleRevoke(shareId: string) {
    if (revoking) return;
    setRevoking(true);
    try {
      const result = await revokeRecipeShareAction({ shareId });
      if (result.ok) {
        showToast({ variant: "success", title: "Share revoked" });
        setState({ kind: "empty" });
        return;
      }
      showToast({
        variant: "error",
        title: "Couldn't revoke",
        description: result.message
      });
    } finally {
      setRevoking(false);
    }
  }

  function whatsappHref(url: string): string {
    // wa.me deep link — works in WhatsApp app on mobile, Web on desktop.
    // The pre-filled message is short on purpose; the receiver tap
    // expands the OG preview from the share URL itself.
    const message = `Recipe for ${mealName}: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Share &ldquo;{mealName}&rdquo;</DialogTitle>
        <DialogDescription>
          Anyone with the link can view this recipe. You can revoke it anytime.
        </DialogDescription>
      </DialogHeader>

      {state.kind === "loading" ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {state.kind === "empty" ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Generate a public link to share this recipe via WhatsApp, iMessage,
            or anywhere else.
          </p>
          <Button type="button" onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create share link
          </Button>
        </div>
      ) : null}

      {state.kind === "active" ? (
        <div className="grid gap-3">
          <label
            htmlFor="share-url"
            className="text-[11px] uppercase tracking-wide text-muted-foreground"
          >
            Public link
          </label>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background/60 p-2">
            <input
              id="share-url"
              readOnly
              value={state.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate border-0 bg-transparent text-sm focus:outline-none"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(state.url)}
              aria-label="Copy link"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" asChild>
              <a href={whatsappHref(state.url)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Send to WhatsApp
              </a>
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={state.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open preview
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Anyone with this link can view the recipe. WhatsApp / iMessage will
            show a preview with the photo. Edits update the public page too.
          </p>
        </div>
      ) : null}

      {state.kind === "upgrade_required" ? (
        <UpgradePrompt feature="recipe_share_create" />
      ) : null}

      {state.kind === "error" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {state.message}
        </div>
      ) : null}

      <DialogFooter className="sm:justify-between">
        {state.kind === "active" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleRevoke(state.shareId)}
            disabled={revoking}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {revoking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Revoke link
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ShareLinkDialog({ open, onOpenChange, mealId, mealName }: ShareLinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Key on (mealId, open) re-mounts the body when the user opens
          the dialog for a different meal or re-opens after closing —
          ensures the share-state load re-runs without a useEffect on
          prop changes. Same pattern as ClonePlanDialog from Round 5. */}
      <ShareLinkDialogBody
        key={`${mealId}:${open ? "open" : "closed"}`}
        onOpenChange={onOpenChange}
        mealId={mealId}
        mealName={mealName}
      />
    </Dialog>
  );
}
