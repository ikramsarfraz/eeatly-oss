"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { MobileScaffold, MobileTopBar } from "@/components/mobile/mobile-scaffold";
import { MobileAppBar } from "@/components/mobile/mobile-app-bar";

type Member = {
  userId: string;
  name: string | null;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
};

type Invitation = { id: string; email: string; createdAt: string; expiresAt: string };

/**
 * R35 mobile-web Members (Kitchen). Renders below `md`; the desktop
 * `<HouseholdClient>` renders `hidden md:block` alongside off the same props.
 * Read surfaces (kitchen card, member list, pending invites) plus an inline
 * invite form for owners, over `trpc.households.invite`.
 */
export function MembersMobile({
  householdName,
  householdCreatedAt,
  currentUserId,
  isOwner,
  members,
  invitations
}: {
  householdName: string;
  householdCreatedAt: string;
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [feedback, setFeedback] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const invite = trpc.households.invite.useMutation({
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: `Invitation sent to ${email.trim()}.` });
      setEmail("");
      router.refresh();
    },
    onError: (error) => {
      const reason = getCause(error)?.reason;
      setFeedback({
        kind: "err",
        msg: reason === "ALREADY_MEMBER" ? "That person is already in your kitchen." : error.message
      });
    }
  });

  const memberYear = new Date(householdCreatedAt).getFullYear();

  return (
    <MobileScaffold>
      <MobileAppBar title="Members" />
      <MobileTopBar big eyebrow={householdName} title="Kitchen." />

      <div className="px-4 pt-3">
        <div className="rounded-[18px] border border-border bg-card p-4">
          <h2 className="font-serif text-[20px] tracking-[-0.01em] text-foreground">{householdName}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink3)]">
            {members.length} member{members.length === 1 ? "" : "s"} · since {memberYear}
          </p>
        </div>
      </div>

      <section className="px-4 pt-5">
        <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">Members</h3>
        <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-card">
          {members.map((m) => {
            const display = m.name?.trim() || m.email;
            return (
              <li key={m.userId} className="flex items-center gap-3 px-3.5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-[17px] text-primary">
                  {(display.charAt(0) || "?").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14.5px] font-semibold text-foreground">{display}</span>
                    {m.userId === currentUserId && (
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--ink3)]">
                        You
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">{m.email}</span>
                </span>
                <RolePill role={m.role} />
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && invitations.length > 0 && (
        <section className="px-4 pt-5">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
            Pending invitations
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-card">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-[color:var(--surface-2)] text-[color:var(--ink3)]">
                  <Mail className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{inv.email}</span>
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[color:var(--ink3)]">
                  Pending
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && (
        <section className="px-4 pb-4 pt-5">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink3)]">
            Invite someone
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFeedback(null);
              if (email.trim()) invite.mutate({ email: email.trim() });
            }}
            className="flex gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="h-11 min-w-0 flex-1 rounded-[12px] border border-border bg-card px-3.5 text-[14px] text-foreground outline-none placeholder:text-[color:var(--ink3)] focus:border-primary"
            />
            <button
              type="submit"
              disabled={invite.isPending || !email.trim()}
              className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {invite.isPending ? "Sending…" : "Invite"}
            </button>
          </form>
          {feedback && (
            <p
              className={cn(
                "mt-2 text-[12.5px]",
                feedback.kind === "ok" ? "text-primary" : "text-[color:var(--danger)]"
              )}
            >
              {feedback.msg}
            </p>
          )}
        </section>
      )}
    </MobileScaffold>
  );
}

function RolePill({ role }: { role: "owner" | "member" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold capitalize",
        role === "owner" ? "bg-secondary text-primary" : "bg-[color:var(--surface-2)] text-muted-foreground"
      )}
    >
      {role}
    </span>
  );
}
