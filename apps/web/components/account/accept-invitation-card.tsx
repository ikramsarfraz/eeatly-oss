"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GitMerge, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";

export type AcceptInvitationCardProps = {
  token: string;
  inviterName: string;
  householdName: string;
};

type LocalError =
  | { kind: "generic"; message: string }
  | { kind: "ownership_transfer"; message: string }
  | { kind: "meal_collision"; message: string; names: readonly string[] };

type Preview = {
  mealsToMerge: number;
  logsToMerge: number;
  willDissolveCurrentHousehold: boolean;
};

export function AcceptInvitationCard({
  token,
  inviterName,
  householdName
}: AcceptInvitationCardProps) {
  const router = useRouter();
  const [success, setSuccess] = React.useState<{ moved: number } | null>(null);
  const [error, setError] = React.useState<LocalError | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [previewError, setPreviewError] = React.useState<LocalError | null>(null);
  const previewMutation = trpc.households.acceptInvitation.useMutation();
  const acceptMutation = trpc.households.acceptInvitation.useMutation();
  const pending = acceptMutation.isPending;
  const previewing = previewMutation.isPending;

  function toLocalError(e: unknown): LocalError {
    const cause = getCause(e);
    const reason = cause?.reason;
    const message =
      e instanceof Error ? e.message : "Couldn't accept invitation.";
    if (reason === "OWNERSHIP_TRANSFER_REQUIRED") {
      return { kind: "ownership_transfer", message };
    }
    if (reason === "MEAL_NAME_COLLISION") {
      const names = (cause as { collidingNames?: string[] } | null)
        ?.collidingNames;
      return { kind: "meal_collision", message, names: names ?? [] };
    }
    return { kind: "generic", message };
  }

  // R15.5 Task 6 — fetch the merge preview as soon as the card renders.
  // The dry-run runs the same validation as the real accept, so any
  // collision / ownership-transfer errors surface here before the user
  // commits.
  React.useEffect(() => {
    if (preview || previewError || previewing) return;
    previewMutation
      .mutateAsync({ token, dryRun: true })
      .then((result) => {
        if (result.kind !== "preview") return;
        setPreview({
          mealsToMerge: result.mealsToMerge,
          logsToMerge: result.logsToMerge,
          willDissolveCurrentHousehold: result.willDissolveCurrentHousehold
        });
      })
      .catch((e) => {
        setPreviewError(toLocalError(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Synchronous re-entry lock: `isPending` flips a tick after mutateAsync
  // starts, so a fast double-click could fire two accepts before the button
  // disables. The ref blocks the second call immediately.
  const submittingRef = React.useRef(false);

  async function handleAccept() {
    if (pending || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try {
      const result = await acceptMutation.mutateAsync({ token });
      if (result.kind !== "accepted") return;
      setSuccess({ moved: result.mealsMoved + result.logsMoved });
      setTimeout(() => router.push("/home"), 900);
    } catch (e) {
      setError(toLocalError(e));
    } finally {
      submittingRef.current = false;
    }
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            You&apos;re in
          </CardTitle>
          <CardDescription>
            Taking you to {householdName}…
            {success.moved > 0 ? ` (${success.moved} meals & logs merged)` : ""}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasMergeContent =
    preview &&
    (preview.mealsToMerge > 0 ||
      preview.logsToMerge > 0 ||
      preview.willDissolveCurrentHousehold);

  // The dry-run already ran the full accept validation, so a collision or
  // ownership-transfer preview error means the real accept is guaranteed to
  // fail the same way — keep the button disabled instead of letting the
  // user collect a second copy of the same error. Generic preview errors
  // (network blips) don't block; accepting may still succeed.
  const blockingPreviewError = previewError && previewError.kind !== "generic";
  // One error slot: a fresh accept error supersedes the preview error
  // rather than stacking a duplicate panel under it.
  const visibleError = error ?? previewError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {inviterName} invited you to {householdName}
        </CardTitle>
        <CardDescription>
          Join {householdName} to plan and cook together. Your recipes and history move
          with you, but stay private. Kitchen members only see the meals and plans you
          choose to share.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!previewError && previewing && !preview ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking what would merge…
          </div>
        ) : null}
        {!previewError && preview && hasMergeContent ? (
          <div className="grid gap-1.5 rounded-lg border bg-primary/5 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-primary">
              <GitMerge className="h-4 w-4" />
              What happens when you accept
            </p>
            <p className="text-foreground">
              {preview.mealsToMerge > 0
                ? `${preview.mealsToMerge} of your meals`
                : "No meals"}
              {preview.logsToMerge > 0
                ? ` and ${preview.logsToMerge} cook ${preview.logsToMerge === 1 ? "log" : "logs"}`
                : ""}{" "}
              move into {householdName}.
              {preview.willDissolveCurrentHousehold
                ? " Your current personal kitchen will be dissolved."
                : ""}
            </p>
            <p className="text-muted-foreground">
              You keep ownership of everything you bring. If a dish name
              already exists in {householdName}, both copies stay, each
              visible only to its owner.
            </p>
          </div>
        ) : null}
        {visibleError ? <ErrorPanel error={visibleError} /> : null}
        <Button
          type="button"
          onClick={handleAccept}
          disabled={pending || previewing || Boolean(blockingPreviewError)}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Joining…" : "Accept & join"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorPanel({ error }: { error: LocalError }) {
  if (error.kind === "meal_collision") {
    return (
      <div className="grid gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="font-medium text-destructive">Resolve duplicates before joining</p>
        <p className="text-muted-foreground">{error.message}</p>
        {error.names.length > 0 ? (
          <ul className="list-disc pl-5 text-foreground">
            {error.names.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (error.kind === "ownership_transfer") {
    return (
      <div className="grid gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="font-medium text-destructive">Transfer ownership first</p>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {error.message}
    </div>
  );
}
