"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";

/**
 * Signed-in accept step for a sharing-circle invitation. Accepting creates
 * the connection, then routes to the People page.
 */
export function ConnectAcceptCard({
  token,
  inviterName
}: {
  token: string;
  inviterName: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const accept = trpc.connections.acceptInvitation.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        showToast({
          variant: "success",
          title: `Connected with ${res.inviterName ?? inviterName}`
        });
        router.replace("/people" as Route);
      } else {
        showToast({ variant: "error", title: res.message });
      }
    },
    onError: (e) =>
      showToast({ variant: "error", title: "Couldn't accept", description: e.message })
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect with {inviterName}?</CardTitle>
        <CardDescription>
          You&apos;ll join their sharing circle. They can then share specific recipes and plans
          with you, and anything you share appears in their &ldquo;Shared with you.&rdquo;
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button
          className="w-full"
          disabled={accept.isPending}
          onClick={() => accept.mutate({ token })}
        >
          Accept invitation
        </Button>
      </CardContent>
    </Card>
  );
}
