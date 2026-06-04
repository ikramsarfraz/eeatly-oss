"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";

const CONFIRMATION_PHRASE = "delete my account";

export function DeleteAccountCard() {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const deleteMutation = trpc.auth.deleteAccount.useMutation();
  const pending = deleteMutation.isPending;

  const phraseMatches = phrase.trim().toLowerCase() === CONFIRMATION_PHRASE;

  async function handleConfirm() {
    if (!phraseMatches) return;
    try {
      // Round 11: tRPC procedures don't redirect — they return the
      // post-sign-out target and the client navigates. `assign` (not
      // `router.push`) is intentional so the freshly-cleared Better
      // Auth cookie state takes effect on the next page load.
      const result = await deleteMutation.mutateAsync({
        confirmationPhrase: phrase
      });
      window.location.assign(result.redirectTo);
    } catch (error) {
      const cause = getCause(error);
      if (cause?.reason === "OWNER_BLOCK") {
        showToast({
          variant: "error",
          title: "Can't delete your account yet",
          description:
            "You own a household with other members. Transfer ownership before deleting — for now, contact support to make the change (the in-product transfer flow is coming)."
        });
        return;
      }
      showToast({
        variant: "error",
        title: "Couldn't delete your account",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Delete account
        </CardTitle>
        <CardDescription>
          Permanently delete your eeatly account and all of your meal history.
          This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground">
        <p>
          We&apos;ll remove your meals, logs, notes, and notifications. Anonymized
          analytics events stay, with your user id stripped.
        </p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setPhrase("");
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              Delete my account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your eeatly account?</DialogTitle>
              <DialogDescription>
                This deletes your meal history, notes, and notifications.
                You can&apos;t undo this from the app.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="confirmDelete">
                Type <span className="font-mono-brand text-foreground">{CONFIRMATION_PHRASE}</span> to confirm.
              </Label>
              <Input
                id="confirmDelete"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                autoComplete="off"
                disabled={pending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!phraseMatches || pending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
