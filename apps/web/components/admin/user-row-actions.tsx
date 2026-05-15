"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { betaCohortValues } from "@/lib/validators/beta-cohort";

/**
 * Round 11 — client-side wrapper for the admin /users row actions.
 * Replaces the Round 4-era `<form action={serverAction}>` blocks
 * because tRPC mutations expect JSON, not FormData. The server
 * component (`app/admin/users/page.tsx`) renders one of these per
 * user row.
 */
type Cohort = (typeof betaCohortValues)[number];
type Template =
  | "welcome"
  | "first_meal_encouragement"
  | "inactive_reminder"
  | "weekly_recap_placeholder";

const cohortLabels: Record<Cohort, string> = {
  alpha: "Alpha",
  beta_wave_1: "Beta wave 1",
  beta_wave_2: "Beta wave 2",
  internal: "Internal"
};

// The full `BetaCohort` type includes `beta_2026` (Round 6 paid-tier
// migration value) which the picker can't assign. Accept it as input
// so the row prop passes through unchanged; the dropdown just doesn't
// list it as a target option.
type AnyBetaCohort = Cohort | "beta_2026";

export function UserCohortPicker({
  userId,
  currentCohort
}: {
  userId: string;
  currentCohort: AnyBetaCohort | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [draft, setDraft] = React.useState<string>(currentCohort ?? "");
  const updateMutation = trpc.admin.updateBetaCohort.useMutation();

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({
        userId,
        cohort: draft === "" ? null : (draft as Cohort)
      });
      showToast({ variant: "success", title: "Cohort updated" });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't update cohort",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        className="h-9 rounded-md border bg-background px-2 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      >
        <option value="">Unassigned</option>
        {betaCohortValues.map((value) => (
          <option key={value} value={value}>
            {cohortLabels[value]}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : null}
        Save cohort
      </Button>
    </div>
  );
}

export function UserLifecycleEmailButtons({ userId }: { userId: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const dispatchMutation = trpc.admin.dispatchLifecycleEmail.useMutation();
  const trackMutation = trpc.admin.trackReminderPlaceholder.useMutation();

  async function send(template: Template) {
    try {
      const result = await dispatchMutation.mutateAsync({ userId, template });
      showToast({
        variant: result.skipped ? "info" : "success",
        title: result.skipped
          ? "Email skipped"
          : "Email dispatched"
      });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't dispatch email",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  async function track(
    event:
      | "reminder_email_open_placeholder"
      | "reminder_email_clicked_placeholder"
  ) {
    try {
      await trackMutation.mutateAsync({ userId, event });
      showToast({ variant: "success", title: "Logged" });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't log",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button size="sm" type="button" variant="outline" onClick={() => send("welcome")}>
          Welcome
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => send("first_meal_encouragement")}
        >
          First-meal poke
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => send("inactive_reminder")}
        >
          Quiet streak
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => send("weekly_recap_placeholder")}
        >
          Weekly recap test
        </Button>
      </div>
      <details className="mt-3 text-muted-foreground">
        <summary className="cursor-pointer">Analytics placeholders</summary>
        <div className="mt-2 flex flex-col gap-1">
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => track("reminder_email_open_placeholder")}
          >
            Log open stub
          </Button>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => track("reminder_email_clicked_placeholder")}
          >
            Log click stub
          </Button>
        </div>
      </details>
    </>
  );
}
