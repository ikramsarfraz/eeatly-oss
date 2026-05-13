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
import { deleteAccountAction } from "@/actions/account";

const CONFIRMATION_PHRASE = "delete my account";

export function DeleteAccountCard() {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const phraseMatches = phrase.trim().toLowerCase() === CONFIRMATION_PHRASE;

  async function handleConfirm() {
    if (!phraseMatches) return;
    setPending(true);
    try {
      // The action redirects on success — control normally won't return.
      await deleteAccountAction(phrase);
    } catch (error) {
      // The NEXT_REDIRECT thrown by `redirect()` is intentionally not a
      // user-facing error. Let it bubble silently.
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("NEXT_REDIRECT")) return;

      setPending(false);
      // Round-4 guard: owners of multi-member households get a dedicated
      // toast pointing at the resolution path. The action throws
      // `OwnerAccountDeletionBlockedError`, but server actions don't
      // preserve the class across the boundary — match on the message
      // prefix the class uses.
      const isOwnerBlocked = message.startsWith("You own a household");
      showToast({
        variant: "error",
        title: isOwnerBlocked
          ? "Can't delete your account yet"
          : "Couldn't delete your account",
        description: message
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
