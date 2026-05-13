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
import { acceptInvitationAction } from "@/actions/households";

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
  const [pending, setPending] = React.useState(false);
  const [success, setSuccess] = React.useState<{ moved: number } | null>(null);
  const [error, setError] = React.useState<LocalError | null>(null);

  async function handleAccept() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await acceptInvitationAction({ token });
      if (result.ok) {
        setSuccess({ moved: result.mealsMoved + result.logsMoved });
        // Soft navigate after a beat so the success state is visible.
        setTimeout(() => router.push("/dashboard"), 900);
        return;
      }
      if (result.code === "OWNERSHIP_TRANSFER_REQUIRED") {
        setError({ kind: "ownership_transfer", message: result.message });
      } else if (result.code === "MEAL_NAME_COLLISION") {
        setError({
          kind: "meal_collision",
          message: result.message,
          names: result.collidingNames ?? []
        });
      } else {
        setError({ kind: "generic", message: result.message });
      }
    } catch (e) {
      setError({
        kind: "generic",
        message: e instanceof Error ? e.message : "Couldn't accept invitation."
      });
    } finally {
      setPending(false);
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
