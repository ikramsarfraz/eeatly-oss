"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
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

export type SubscriptionCardProps = {
  /**
   * Server-resolved snapshot. The component renders a different state
   * for each shape:
   *   - `null` + `!isBetaCohort` → free plan, "Upgrade" CTA
   *   - `null` + `isBetaCohort`  → free plan, beta indicator + "Upgrade" CTA
   *   - status === "active"      → renews / ends copy
   *   - status === "past_due"    → payment failed, prominent portal
   *   - status === "canceled" with currentPeriodEnd in future → ending copy
   *   - any other terminal state → free-plan view with explanatory note
   */
  subscription: {
    status:
      | "active"
      | "past_due"
      | "canceled"
      | "incomplete"
      | "incomplete_expired"
      | "trialing"
      | "unpaid";
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  isBetaCohort: boolean;
  billingConfigured: boolean;
};

export function SubscriptionCard({
  subscription,
  isBetaCohort,
  billingConfigured
}: SubscriptionCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const portalMutation = trpc.billing.createPortalSession.useMutation();
  const portalPending = portalMutation.isPending;

  // Surface a success toast when the user returns from a completed
  // checkout. We don't wait for the webhook here — the server-resolved
  // subscription state may still be null on this render (webhook race);
  // the toast is the immediate feedback the user expects.
  const upgradedFlag = searchParams.get("upgraded") === "true";
  // Re-render with a stable signal once Stripe redirects back.
  React.useEffect(() => {
    if (upgradedFlag) {
      showToast({
        variant: "success",
        title: "Welcome to eeatly Plus",
        description:
          subscription?.status === "active"
            ? undefined
            : "Your subscription is finalizing — refresh in a moment if Plus features aren't unlocked yet."
      });
      // Clear the query param so refreshing doesn't re-fire the toast.
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("upgraded");
      const query = sp.toString();
      router.replace(`/settings${query ? `?${query}` : ""}` as Route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradedFlag]);

  async function openPortal() {
    if (portalPending) return;
    try {
      const result = await portalMutation.mutateAsync();
      window.location.href = result.url;
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't open billing portal",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  if (!billingConfigured) {
    // Coming-soon state — environments without Stripe env vars. Free
    // tier copy with no upgrade CTA at all.
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            You&apos;re on the free plan. Plus is coming soon to this environment.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Active subscriber (or trialing).
  if (subscription?.status === "active" || subscription?.status === "trialing") {
    const endDate = subscription.currentPeriodEnd
      ? format(subscription.currentPeriodEnd, "MMM d, yyyy")
      : null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            eeatly Plus
          </CardTitle>
          <CardDescription>
            {subscription.cancelAtPeriodEnd
              ? endDate
                ? `Ends ${endDate} — you can reactivate from the portal.`
                : "Ending soon — manage from the portal."
              : endDate
                ? `Renews ${endDate}.`
                : "Active."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={openPortal}
            disabled={portalPending}
          >
            {portalPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Manage billing
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (subscription?.status === "past_due" || subscription?.status === "unpaid") {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Payment failed</CardTitle>
          <CardDescription>
            Update your card from the Stripe portal to keep your Plus access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={openPortal}
            disabled={portalPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {portalPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update payment method
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Free plan (subscription === null, or in a terminal state like
  // canceled/incomplete_expired with no future period_end).
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>
          {isBetaCohort
            ? "Free plan — and you're in the beta, so Plus features are unlocked."
            : "You're on the free plan."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={"/pricing" as Route}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {isBetaCohort ? "See Plus" : "Upgrade to Plus"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
