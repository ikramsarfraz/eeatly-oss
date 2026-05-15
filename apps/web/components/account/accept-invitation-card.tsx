"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
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

export function AcceptInvitationCard({
  token,
  inviterName,
  householdName
}: AcceptInvitationCardProps) {
  const router = useRouter();
  const [success, setSuccess] = React.useState<{ moved: number } | null>(null);
  const [error, setError] = React.useState<LocalError | null>(null);
  const acceptMutation = trpc.households.acceptInvitation.useMutation();
  const pending = acceptMutation.isPending;

  async function handleAccept() {
    if (pending) return;
    setError(null);
    try {
      const result = await acceptMutation.mutateAsync({ token });
      setSuccess({ moved: result.mealsMoved + result.logsMoved });
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (e) {
      const cause = getCause(e);
      const reason = cause?.reason;
      const message =
        e instanceof Error ? e.message : "Couldn't accept invitation.";
      if (reason === "OWNERSHIP_TRANSFER_REQUIRED") {
        setError({ kind: "ownership_transfer", message });
      } else if (reason === "MEAL_NAME_COLLISION") {
        const names = (cause as { collidingNames?: string[] } | null)
          ?.collidingNames;
        setError({
          kind: "meal_collision",
          message,
          names: names ?? []
        });
      } else {
        setError({ kind: "generic", message });
      }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {inviterName} invited you to {householdName}
        </CardTitle>
        <CardDescription>
          Your existing meals and cooking history will be merged into this kitchen.
          Everyone here will see all logs together.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error ? <ErrorPanel error={error} /> : null}
        <Button type="button" onClick={handleAccept} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "Joining…" : "Join this kitchen"}
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
