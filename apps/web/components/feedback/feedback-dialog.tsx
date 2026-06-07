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
  /**
   * Controlled mode. When `open` is provided the dialog renders no inline
   * trigger and its visibility is driven by the parent. Used by the mobile
   * account menu, which opens feedback imperatively; the desktop sidebar keeps
   * the default trigger-based, uncontrolled mode.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const feedbackTypeLabels: Record<FeedbackInput["type"], string> = {
  bug: "Bug",
  confusion: "Confusion",
  feature_request: "Feature request",
  general: "General"
};

export function FeedbackDialog({ trigger, open: controlledOpen, onOpenChange }: FeedbackDialogProps) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange]
  );
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

  const content = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogDescription>
          Tell us what felt confusing, useful, or missing.
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={handleSend}>
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
      </form>
    </DialogContent>
  );

  // Controlled mode (mobile account menu): no inline trigger; the parent drives
  // visibility, so render just the dialog.
  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {content}
      </Dialog>
    );
  }

  // Uncontrolled mode (desktop sidebar): the trigger opens the dialog. Before
  // hydration, render only the trigger so the SSR markup stays stable.
  if (!hydrated) {
    return <>{trigger ?? defaultTrigger}</>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      {content}
    </Dialog>
  );
}
