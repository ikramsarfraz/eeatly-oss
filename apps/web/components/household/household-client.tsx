"use client";

import * as React from "react";
import {
  Check,
  Crown,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionLabel } from "@/components/ui/section-label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { isUpgradeRequired } from "@/lib/trpc/errors";

/**
 * Round 31 — Kitchen page editorial renderer.
 *
 * The R23/R24 `<HouseholdCard>` lived inside Settings as one of many
 * cards on a long stack. R31 promotes Kitchen to its own surface at
 * `/kitchen` so the editorial hero + Members + Pending invitations
 * have space to breathe, and the Settings page can collapse its
 * household section into a single "Manage →" row.
 *
 * Layout:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ THE                                            │  ← italic kicker
 *   │ household name.                                │  ← 64-80px serif
 *   │ [N members] [created] [recipes+cooks]         │  ← chip row
 *   ├───────────────────────────────────────────────┤
 *   │ Members                                        │
 *   │   ┌─────────────────────────────────────────┐ │
 *   │   │ Member rows · Manage dropdown (owner)   │ │
 *   │   └─────────────────────────────────────────┘ │
 *   │ Invite form (owner)                            │
 *   │ Pending invitations                            │
 *   │ Roles (decorative info grid)                   │
 *   └───────────────────────────────────────────────┘
 *
 * Member Manage dropdown — surfaces "Remove member" wired to
 * `trpc.households.removeMember`. R31 does not introduce role-change
 * procedures, so the dropdown intentionally has a single destructive
 * action (plus a disabled "Transfer ownership — coming soon" affordance
 * for owners). Future role-change procedures slot in here without
 * shape change.
 */

export type HouseholdClientMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type HouseholdClientInvitation = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

export type HouseholdClientProps = {
  householdName: string;
  householdCreatedAt: string;
  currentUserId: string;
  isOwner: boolean;
  members: HouseholdClientMember[];
  invitations: HouseholdClientInvitation[];
};

export function HouseholdClient({
  householdName,
  householdCreatedAt,
  currentUserId,
  isOwner,
  members,
  invitations
}: HouseholdClientProps) {
  const { showToast } = useToast();
  const [email, setEmail] = React.useState("");
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = React.useState<string | null>(null);
  // Kitchen-name edit (owner only). `displayName` is the live value so the
  // hero updates immediately after a successful rename without a refresh.
  const [displayName, setDisplayName] = React.useState(householdName);
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(householdName);

  const inviteMutation = trpc.households.invite.useMutation();
  const revokeMutation = trpc.households.revokeInvitation.useMutation();
  const removeMutation = trpc.households.removeMember.useMutation();
  const renameMutation = trpc.households.rename.useMutation();
  const pendingInvite = inviteMutation.isPending;

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const next = nameDraft.trim();
    if (!next || renameMutation.isPending) return;
    if (next === displayName) {
      setEditingName(false);
      return;
    }
    try {
      const result = await renameMutation.mutateAsync({ name: next });
      setDisplayName(result.name);
      setEditingName(false);
      showToast({ variant: "success", title: "Kitchen renamed" });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't rename",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || pendingInvite) return;
    try {
      await inviteMutation.mutateAsync({ email });
      showToast({
        variant: "success",
        title: "Invitation sent",
        description: `We emailed an invite to ${email.trim()}.`
      });
      setEmail("");
    } catch (error) {
      showToast({
        variant: "error",
        title: isUpgradeRequired(error)
          ? "Upgrade required"
          : "Couldn't send invitation",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  async function handleRevoke(invitationId: string) {
    if (revokingId) return;
    setRevokingId(invitationId);
    try {
      await revokeMutation.mutateAsync({ invitationId });
      showToast({ variant: "success", title: "Invitation revoked" });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't revoke",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRemove(targetUserId: string, targetName: string) {
    if (removingUserId) return;
    setRemovingUserId(targetUserId);
    try {
      const result = await removeMutation.mutateAsync({ targetUserId });
      showToast({
        variant: "success",
        title: `Removed ${result.removedUserName}`
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: `Couldn't remove ${targetName}`,
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setRemovingUserId(null);
    }
  }

  const recipesAndCooksLabel = `${members.length} ${members.length === 1 ? "cook" : "cooks"}`;

  return (
    <div className="grid gap-7 pb-20 md:pb-0">
      {/* Editorial hero */}
      <header className="grid gap-3">
        <p
          className="font-serif text-[18px] italic leading-none text-muted-foreground sm:text-[20px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          The
        </p>
        {editingName ? (
          <form onSubmit={handleRename} className="grid gap-2.5 sm:max-w-[560px]">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={60}
              autoFocus
              aria-label="Kitchen name"
              className="h-auto py-2 font-serif text-[28px] leading-tight sm:text-[36px]"
            />
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={renameMutation.isPending || !nameDraft.trim()}
              >
                {renameMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNameDraft(displayName);
                  setEditingName(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <h1
              className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[60px] lg:text-[80px]"
              style={{ letterSpacing: "-0.028em" }}
            >
              {displayName.toLowerCase()}.
            </h1>
            {isOwner ? (
              <Button
                type="button"
                variant="ghost"
                className="mb-2 min-h-[32px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setNameDraft(displayName);
                  setEditingName(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </Button>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="sage" className="text-[11.5px]">
            {members.length} {members.length === 1 ? "member" : "members"}
          </Badge>
          <Badge variant="ghost" className="text-[11.5px]">
            since {formatMonthYear(householdCreatedAt)}
          </Badge>
          <Badge variant="wheat" className="text-[11.5px]">
            {recipesAndCooksLabel}
          </Badge>
        </div>
      </header>

      <div className="grid max-w-[820px] gap-8">
        {/* Members */}
        <section className="grid gap-3">
          <SectionLabel>Members</SectionLabel>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-[var(--border-soft,var(--border))]">
              {members.map((member) => {
                // Only the owner can remove anyone, and only non-owner
                // members can be removed (never the owner, never self).
                const isSelf = member.userId === currentUserId;
                const canRemove = isOwner && member.role !== "owner" && !isSelf;
                const canShowDropdown = isOwner;
                return (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center gap-3 px-5 py-4"
                  >
                    <Avatar name={member.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-semibold text-foreground">
                          {isSelf ? `${member.name} (you)` : member.name}
                        </span>
                        {member.role === "owner" ? (
                          <Badge variant="sage" className="text-[10.5px]">
                            <Crown className="mr-1 h-3 w-3" />
                            Owner
                          </Badge>
                        ) : (
                          <Badge variant="ghost" className="text-[10.5px]">
                            Member
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <span
                      className="hidden font-mono text-[11px] uppercase text-muted-foreground sm:inline"
                      style={{ letterSpacing: "0.14em" }}
                    >
                      joined {formatMonthYear(member.joinedAt)}
                    </span>
                    {canShowDropdown ? (
                      <ManageMemberMenu
                        member={member}
                        canRemove={canRemove}
                        isSelf={isSelf}
                        onRemove={() => handleRemove(member.userId, member.name)}
                        removing={removingUserId === member.userId}
                        householdName={householdName}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        {/* Invite form (owner-only) */}
        {isOwner ? (
          <section className="grid gap-3">
            <SectionLabel>Invite someone</SectionLabel>
            <Card className="p-5">
              <p className="text-[13px] text-muted-foreground">
                They&apos;ll get a magic link by email. Invitations expire in 7 days.
              </p>
              <form
                onSubmit={handleInvite}
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
              >
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
            </Card>
          </section>
        ) : null}

        {/* Pending invitations (owner-only, shown when any exist) */}
        {isOwner && invitations.length > 0 ? (
          <section className="grid gap-3">
            <SectionLabel>Pending invitations</SectionLabel>
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-[var(--border-soft,var(--border))]">
                {invitations.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-foreground">
                        {invite.email}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        Sent {formatRelative(invite.createdAt)} · expires{" "}
                        {formatExpiry(invite.expiresAt)}
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
            </Card>
          </section>
        ) : null}

        {/* Roles — decorative info grid. Not interactive; helps new
            kitchens understand the two-role model without burying the
            explanation in the invite form's helper text. Mirrors the
            mobile redesign's "Roles" panel from the R26 mock pack. */}
        <section className="grid gap-3">
          <SectionLabel>Roles</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            <RoleCard
              Icon={Crown}
              tone="sage"
              title="Owner"
              body="One per kitchen. Invites and removes members, and (later) controls billing for Chef."
            />
            <RoleCard
              Icon={Users}
              tone="wheat"
              title="Member"
              body="Logs cooks, drops meals into the library, builds plans. Sees everything the kitchen has cooked."
            />
            <RoleCard
              Icon={ShieldCheck}
              tone="ghost"
              title="Privacy"
              body="Cooking history is shared inside the kitchen. eeatly never shares it with anyone outside."
            />
          </div>
        </section>
      </div>

      {/* Suppress unused-import warning for icons reserved for future
          surfaces (e.g. a Plus owner badge). */}
      <span hidden aria-hidden>
        <Sparkles className="h-0 w-0" />
      </span>
    </div>
  );
}

/**
 * R31 — Member Manage dropdown. Surfaces the existing
 * `households.removeMember` procedure plus a disabled
 * "Transfer ownership" affordance that signals where future role-
 * change procedures will land. Disabled states for self / owner /
 * pending mutation are computed by the parent and threaded in.
 */
function ManageMemberMenu({
  member,
  canRemove,
  isSelf,
  removing,
  onRemove,
  householdName
}: {
  member: HouseholdClientMember;
  canRemove: boolean;
  isSelf: boolean;
  removing: boolean;
  onRemove: () => void;
  householdName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          aria-label={`Manage ${member.name}`}
          disabled={removing}
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[12px] font-medium text-muted-foreground">
          {member.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Crown className="h-4 w-4" />
          Transfer ownership
          <span className="ml-auto text-[10.5px] uppercase text-muted-foreground">
            soon
          </span>
        </DropdownMenuItem>
        {canRemove ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-[color:var(--danger-fg)] focus:text-[color:var(--danger-fg)]"
              >
                <UserMinus className="h-4 w-4" />
                Remove from kitchen
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remove {member.name} from {householdName}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  They&apos;ll lose access to shared recipes and plans. The
                  cooks they logged stay in your kitchen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onRemove}
                  className="bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:bg-[color:var(--destructive)]/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <DropdownMenuItem disabled>
            <UserMinus className="h-4 w-4" />
            {member.role === "owner"
              ? "Owner can't be removed"
              : isSelf
                ? "Leave kitchen — soon"
                : "Remove from kitchen"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Roles info card — decorative; not a CTA. Each card uses one of the
 * R23 tone tokens via a wrapping `<Badge>` for the icon so the colors
 * stay in palette under both light + dark.
 */
function RoleCard({
  Icon,
  tone,
  title,
  body
}: {
  Icon: React.ComponentType<{ className?: string }>;
  tone: "sage" | "wheat" | "ghost";
  title: string;
  body: string;
}) {
  return (
    <Card className="grid gap-2 p-4">
      <div className="flex items-center gap-2">
        <Badge variant={tone} className="h-7 w-7 justify-center p-0">
          <Icon className="h-3.5 w-3.5" />
        </Badge>
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
      </div>
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{body}</p>
    </Card>
  );
}

/**
 * Initial avatar — fills in for the absent user-photo upload path
 * (deferred). Uses the user's first letter on a sage circle so the
 * Members list reads as faces-first even before avatars exist.
 */
function Avatar({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--sage)] font-mono text-[14px] font-semibold text-[color:var(--sage-fg)]"
    >
      {letter}
    </div>
  );
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const days = Math.max(
    0,
    Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}
