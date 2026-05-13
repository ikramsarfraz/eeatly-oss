"use client";

import * as React from "react";
import { Loader2, MailPlus, Trash2, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/providers/toast-provider";
import {
  createInvitationAction,
  revokeInvitationAction
} from "@/actions/households";

export type HouseholdCardMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type HouseholdCardInvitation = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

export type HouseholdCardProps = {
  householdName: string;
  members: HouseholdCardMember[];
  invitations: HouseholdCardInvitation[];
  currentUserId: string;
  isOwner: boolean;
};

export function HouseholdCard({
  householdName,
  members,
  invitations,
  currentUserId,
  isOwner
}: HouseholdCardProps) {
  const { showToast } = useToast();
  const [email, setEmail] = React.useState("");
  const [pendingInvite, setPendingInvite] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || pendingInvite) return;
    setPendingInvite(true);
    try {
      const result = await createInvitationAction({ email });
      if (result.ok) {
        showToast({
          variant: "success",
          title: "Invitation sent",
          description: `We emailed an invite to ${email.trim()}.`
        });
        setEmail("");
      } else {
        showToast({
          variant: "error",
          title: "Couldn't send invitation",
          description: result.message
        });
      }
    } finally {
      setPendingInvite(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (revokingId) return;
    setRevokingId(invitationId);
    try {
      const result = await revokeInvitationAction({ invitationId });
      if (result.ok) {
        showToast({ variant: "success", title: "Invitation revoked" });
      } else {
        showToast({
          variant: "error",
          title: "Couldn't revoke",
          description: result.message
        });
      }
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {householdName}
        </CardTitle>
        <CardDescription>
          {isOwner
            ? "Invite people to share your kitchen. Everyone sees all meals and logs together."
            : "You share this kitchen with the people listed below."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Members
          </h3>
          <ul className="grid gap-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {member.userId === currentUserId ? `${member.name} (you)` : member.name}
                    </span>
                    {member.role === "owner" ? (
                      <Badge variant="secondary" className="text-xs">
                        Owner
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {isOwner ? (
          <>
            <Separator />
            <section className="grid gap-3">
              <div className="grid gap-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invite someone
                </h3>
                <p className="text-sm text-muted-foreground">
                  They&apos;ll get an email with a link that expires in 7 days.
                </p>
              </div>
              <form onSubmit={handleInvite} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-1">
                  <Label htmlFor="invite-email" className="sr-only">
                    Email
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={pendingInvite}
                  />
                </div>
                <Button type="submit" disabled={pendingInvite || !email.trim()}>
                  {pendingInvite ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MailPlus className="h-4 w-4" />
                  )}
                  Send invite
                </Button>
              </form>
            </section>

            {invitations.length > 0 ? (
              <>
                <Separator />
                <section className="grid gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pending invitations
                  </h3>
                  <ul className="grid gap-2">
                    {invitations.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{invite.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {formatExpiry(invite.expiresAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(invite.id)}
                          disabled={revokingId === invite.id}
                          aria-label={`Revoke invitation to ${invite.email}`}
                        >
                          {revokingId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Revoke
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const days = Math.max(0, Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}
