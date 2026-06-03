"use client";

import * as React from "react";
import { Loader2, Reply } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { isRateLimited } from "@/lib/trpc/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";

type FeedbackReplyDialogProps = {
  feedbackId: string;
  recipientEmail: string;
  originalMessage: string;
};

/**
 * Admin reply island for the feedback inbox. Sends the typed message to the
 * cook via `feedback.reply` (Resend email). No status/thread is persisted —
 * threaded support is deferred until the schema gains those columns — so the
 * dialog just closes on success.
 */
export function FeedbackReplyDialog({
  feedbackId,
  recipientEmail,
  originalMessage
}: FeedbackReplyDialogProps) {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const replyMutation = trpc.feedback.reply.useMutation();

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    try {
      const result = await replyMutation.mutateAsync({
        feedbackId,
        message: trimmed
      });
      setMessage("");
      setOpen(false);
      showToast({
        variant: "success",
        title: result.sent ? "Reply sent" : "Reply logged",
        description: result.sent
          ? `Emailed ${result.recipientEmail}.`
          : "Email isn't configured — the reply was logged to the server console."
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : undefined;
      showToast({
        variant: "error",
        title: "Unable to send reply",
        description: isRateLimited(error)
          ? detail ?? "Too many replies. Please try again later."
          : detail ?? "Please try again."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Reply className="h-4 w-4" />
          Reply
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reply to feedback</DialogTitle>
          <DialogDescription>
            Emails {recipientEmail} directly. Their original note is quoted in
            the email for context.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide">
              They wrote
            </p>
            <p className="line-clamp-4 whitespace-pre-wrap">{originalMessage}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feedback-reply-message">Your reply</Label>
            <Textarea
              id="feedback-reply-message"
              rows={5}
              placeholder="Thanks for flagging this…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={replyMutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={replyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={replyMutation.isPending || message.trim().length === 0}
          >
            {replyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Send reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
