"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import { usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc/client";
import { isRateLimited } from "@/lib/trpc/errors";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/providers/toast-provider";
import { feedbackInputSchema, type FeedbackInput } from "@eeatly/api/validators/feedback";

type FeedbackDialogProps = {
  trigger?: React.ReactNode;
};

const feedbackTypeLabels: Record<FeedbackInput["type"], string> = {
  bug: "Bug",
  confusion: "Confusion",
  feature_request: "Feature request",
  general: "General"
};

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackInputSchema),
    defaultValues: {
      type: "general",
      message: "",
      context: pathname
    }
  });
  const submitMutation = trpc.feedback.submit.useMutation();
  const isSubmitting = form.formState.isSubmitting || submitMutation.isPending;

  const handleSend = form.handleSubmit(async (values) => {
    try {
      await submitMutation.mutateAsync(values);
      form.reset({ type: "general", message: "", context: pathname });
      setOpen(false);
      showToast({
        variant: "success",
        title: "Feedback sent",
        description: "Thanks for sharing — this genuinely helps."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showToast({
        variant: "error",
        title: "Unable to send feedback",
        description: isRateLimited(error)
          ? message ?? "Too many submissions. Please try again later."
          : message ?? "Please try again."
      });
    }
  });

  React.useEffect(() => {
    if (!form.getValues("context")) {
      form.setValue("context", pathname);
    }
  }, [form, pathname]);

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <MessageSquare className="h-4 w-4" />
      Send feedback
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
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what felt confusing, useful, or missing.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={handleSend}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
              return;
            }

            if ((event.target as HTMLElement | null)?.tagName !== "TEXTAREA") {
              return;
            }

            event.preventDefault();
            void handleSend();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="feedback-type">Feedback type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(value) =>
                form.setValue("type", value as FeedbackInput["type"], {
                  shouldValidate: true
                })
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="feedback-type">
                <SelectValue placeholder="Choose type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(feedbackTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              placeholder="What happened? What was confusing? What would make this easier?"
              disabled={isSubmitting}
              {...form.register("message")}
            />
            {form.formState.errors.message ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.message.message}
              </p>
            ) : null}
          </div>

          <input type="hidden" {...form.register("context")} />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send feedback
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Shortcut: ⌘ Enter or Ctrl+Enter from the message field sends feedback.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
