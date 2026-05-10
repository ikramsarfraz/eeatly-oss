"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import { usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { submitFeedbackAction } from "@/actions/feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { feedbackInputSchema, type FeedbackInput } from "@/lib/validators/feedback";

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
  const isSubmitting = form.formState.isSubmitting;

  const handleSend = form.handleSubmit(async (values) => {
    try {
      await submitFeedbackAction(values);
      form.reset({ type: "general", message: "", context: pathname });
      setOpen(false);
      showToast({
        variant: "success",
        title: "Feedback sent",
        description: "Thanks. This helps shape the beta."
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Unable to send feedback",
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  React.useEffect(() => {
    if (!form.getValues("context")) {
      form.setValue("context", pathname);
    }
  }, [form, pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4" />
            Send feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what felt broken, confusing, or useful during beta testing.
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

          <div className="grid gap-2">
            <Label htmlFor="feedback-context">Page or context</Label>
            <Input
              id="feedback-context"
              placeholder="/dashboard"
              disabled={isSubmitting}
              {...form.register("context")}
            />
            {form.formState.errors.context ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.context.message}
              </p>
            ) : null}
          </div>

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
