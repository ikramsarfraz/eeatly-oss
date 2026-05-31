"use client";

import * as React from "react";
import { Check, Copy, Plus, Share2, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { ItemChip, PeopleOverview, PersonOverview } from "@/services/connections";

/* Per-person avatar palette — deterministic by id, in the handoff's
   sage / wheat / terra family. */
const AVATAR_PALETTES = [
  "bg-[color:var(--sage-soft)] text-[color:var(--sage-fg)]",
  "bg-[color:var(--wheat-soft)] text-[color:var(--wheat-fg)]",
  "bg-[color:var(--terra-soft)] text-[color:var(--terra-fg)]"
] as const;

function paletteFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]!;
}

function initial(nameOrEmail: string): string {
  return (nameOrEmail.trim()[0] ?? "?").toUpperCase();
}

export function PeopleClient({ initialOverview }: { initialOverview: PeopleOverview }) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const overviewQuery = trpc.connections.peopleOverview.useQuery(undefined, {
    initialData: initialOverview
  });
  const overview = overviewQuery.data ?? initialOverview;

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [shareTarget, setShareTarget] = React.useState<PersonOverview | null>(null);

  const refresh = () => void utils.connections.peopleOverview.invalidate();

  const cancelInvite = trpc.connections.cancelInvitation.useMutation({
    onSuccess: () => {
      refresh();
      showToast({ variant: "success", title: "Invitation canceled" });
    }
  });

  const revoke = trpc.sharing.revoke.useMutation({
    onSuccess: (_d, vars) => {
      refresh();
      showToast({
        variant: "success",
        title: "Stopped sharing",
        description: "Their live copy is gone. A copy they saved stays theirs."
      });
      void vars;
    },
    onError: (e) =>
      showToast({ variant: "error", title: "Couldn't update sharing", description: e.message })
  });

  const hasPeople = overview.people.length > 0;
  const hasPending = overview.pendingInvitations.length > 0;
  const firstRun = !hasPeople && !hasPending;

  return (
    <div className="grid gap-7">
      {/* Header — cap-aligned action per the layout system. */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1
            className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[64px]"
            style={{ letterSpacing: "-0.025em" }}
          >
            People.
          </h1>
          <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
            The people you share recipes and plans with.{" "}
            <strong className="text-foreground">Each person only sees what you&apos;ve shared with them</strong>{" "}
            — never your whole library.
          </p>
        </div>
        <div className="pt-1.5">
          <Button variant="default" className="min-h-[40px]" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Invite someone
          </Button>
        </div>
      </header>

      {firstRun ? (
        <FirstRun onInvite={() => setInviteOpen(true)} />
      ) : (
        <>
          {hasPeople ? (
            <section className="grid gap-4">
              <SectionLabel>Your people · {overview.people.length}</SectionLabel>
              <div className="grid gap-4">
                {overview.people.map((person) => (
                  <PersonCard
                    key={person.userId}
                    person={person}
                    onShareSomething={() => setShareTarget(person)}
                    onUnshare={(item) =>
                      revoke.mutate({
                        itemType: item.itemType,
                        itemId: item.itemId,
                        granteeUserId: person.userId
                      })
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {hasPending ? (
            <section className="grid gap-3">
              <SectionLabel>Pending invitations</SectionLabel>
              <div className="overflow-hidden rounded-[14px] border bg-[var(--surface)]">
                {overview.pendingInvitations.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-4 py-3",
                      i > 0 && "border-t border-[var(--border-soft,var(--border))]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{inv.email}</p>
                      <p
                        className="font-mono text-[10.5px] uppercase text-muted-foreground"
                        style={{ letterSpacing: "0.13em" }}
                      >
                        Invited · nothing shared yet
                      </p>
                    </div>
                    <CopyLinkButton url={inv.url} />
                    <Button
                      variant="ghost"
                      className="min-h-[34px] text-[color:var(--danger,#b4472e)]"
                      disabled={cancelInvite.isPending}
                      onClick={() => cancelInvite.mutate({ invitationId: inv.id })}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <p className="rounded-[14px] bg-[color:var(--sage-soft)] px-4 py-3 text-[13px] leading-[1.55] text-[color:var(--sage-fg)]">
        Adding someone here doesn&apos;t give them anything. They only see a recipe or plan once you{" "}
        <strong>share that specific item</strong> with them — and what they share back appears in
        your <strong>Shared with you</strong>.
      </p>

      <InviteDialog
        key={inviteOpen ? "invite-open" : "invite-closed"}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={refresh}
      />
      <SharePicker
        person={shareTarget}
        onOpenChange={(o) => !o && setShareTarget(null)}
        onShared={refresh}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[10.5px] uppercase text-muted-foreground"
      style={{ letterSpacing: "0.14em" }}
    >
      {children}
    </p>
  );
}

function PersonCard({
  person,
  onShareSomething,
  onUnshare
}: {
  person: PersonOverview;
  onShareSomething: () => void;
  onUnshare: (item: ItemChip) => void;
}) {
  const label = person.name?.trim() || person.email;
  return (
    <div className="rounded-[16px] border bg-[var(--surface)]">
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-serif text-[20px]",
            paletteFor(person.userId)
          )}
        >
          {initial(label)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-foreground">{label}</p>
          <p
            className="truncate font-mono text-[11px] text-muted-foreground"
            style={{ letterSpacing: "0.02em" }}
          >
            {person.email}
          </p>
        </div>
      </div>
      <div className="grid border-t border-[var(--border-soft,var(--border))] md:grid-cols-2">
        {/* You share with them */}
        <div className="px-5 py-4 md:border-r md:border-[var(--border-soft,var(--border))]">
          <SectionLabel>
            You share with {firstName(label)} · {person.sharedToThem.length}
          </SectionLabel>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {person.sharedToThem.map((item) => (
              <span
                key={`${item.itemType}:${item.itemId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper,var(--surface-2))] px-3 py-1.5 text-[13px] text-foreground"
              >
                <TypeDot itemType={item.itemType} />
                <span className="max-w-[160px] truncate">{item.name}</span>
                <button
                  type="button"
                  aria-label={`Stop sharing ${item.name}`}
                  onClick={() => onUnshare(item)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-[color:var(--danger-soft,#f2ded7)] hover:text-[color:var(--danger,#b4472e)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={onShareSomething}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-strong,var(--border))] px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Share something
            </button>
          </div>
        </div>
        {/* They share with you */}
        <div className="border-t border-[var(--border-soft,var(--border))] px-5 py-4 md:border-t-0">
          <SectionLabel>
            {firstName(label)} shares with you · {person.sharedToMe.length}
          </SectionLabel>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {person.sharedToMe.length === 0 ? (
              <span className="font-serif text-[15px] italic text-muted-foreground">
                Nothing yet.
              </span>
            ) : (
              person.sharedToMe.map((item) => (
                <span
                  key={`${item.itemType}:${item.itemId}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--sage-soft)] px-3 py-1.5 text-[13px] text-[color:var(--sage-fg)]"
                >
                  <TypeDot itemType={item.itemType} />
                  <span className="max-w-[160px] truncate">{item.name}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeDot({ itemType }: { itemType: ItemChip["itemType"] }) {
  return (
    <span
      aria-hidden
      className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
      style={{
        backgroundColor:
          itemType === "recipe" ? "var(--primary)" : "var(--terra, #c66b47)"
      }}
    />
  );
}

function firstName(label: string): string {
  return label.split(/\s+/)[0] ?? label;
}

function CopyLinkButton({ url }: { url: string }) {
  const { showToast } = useToast();
  return (
    <Button
      variant="outline"
      className="min-h-[34px]"
      onClick={() => {
        void navigator.clipboard?.writeText(url);
        showToast({ variant: "success", title: "Invite link copied" });
      }}
    >
      <Copy className="h-3.5 w-3.5" />
      Copy link
    </Button>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvited
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvited: () => void;
}) {
  const { showToast } = useToast();
  const [email, setEmail] = React.useState("");
  const [link, setLink] = React.useState<string | null>(null);

  const invite = trpc.connections.invite.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        setLink(res.url);
        onInvited();
        showToast({ variant: "success", title: "Invitation created" });
      } else {
        showToast({ variant: "error", title: res.message });
      }
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't invite", description: e.message })
  });

  // Reset on close in the change handler (not an effect) to avoid a
  // synchronous setState-in-effect cascade.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmail("");
      setLink(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-[26px]">Invite someone</DialogTitle>
          <DialogDescription>
            They join your sharing circle. Connecting grants nothing on its own — you share
            individual recipes and plans afterward.
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="grid gap-3">
            <p className="text-[13px] text-muted-foreground">
              Send them this link to connect:
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="font-mono text-[12px]" />
              <CopyLinkButton url={link} />
            </div>
            <Button variant="default" className="mt-1" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) invite.mutate({ email: email.trim() });
            }}
          >
            <Input
              type="email"
              required
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
            />
            <Button type="submit" variant="default" disabled={invite.isPending}>
              <UserPlus className="h-3.5 w-3.5" />
              Create invite
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SharePicker({
  person,
  onOpenChange,
  onShared
}: {
  person: PersonOverview | null;
  onOpenChange: (o: boolean) => void;
  onShared: () => void;
}) {
  const { showToast } = useToast();
  const open = person !== null;
  const ownedQuery = trpc.connections.ownedItems.useQuery(undefined, { enabled: open });

  const grant = trpc.sharing.grant.useMutation({
    onSuccess: () => {
      onShared();
      showToast({ variant: "success", title: "Shared" });
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't share", description: e.message })
  });

  // Items already shared to this person (hide from the picker).
  const alreadyShared = new Set(
    (person?.sharedToThem ?? []).map((i) => `${i.itemType}:${i.itemId}`)
  );
  const candidates = (ownedQuery.data ?? []).filter(
    (i) => !alreadyShared.has(`${i.itemType}:${i.itemId}`)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-[24px]">
            Share with {person ? firstName(person.name?.trim() || person.email) : ""}
          </DialogTitle>
          <DialogDescription>
            Pick a recipe or plan to give them a live, read-only copy. You can stop sharing
            anytime.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[360px] overflow-y-auto">
          {ownedQuery.isLoading ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Nothing left to share with them.
            </p>
          ) : (
            <ul className="grid gap-1">
              {candidates.map((item) => (
                <li key={`${item.itemType}:${item.itemId}`}>
                  <button
                    type="button"
                    disabled={grant.isPending}
                    onClick={() =>
                      person &&
                      grant.mutate({
                        itemType: item.itemType,
                        itemId: item.itemId,
                        granteeUserId: person.userId
                      })
                    }
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-[var(--surface-2)]"
                  >
                    <TypeDot itemType={item.itemType} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                      {item.name}
                    </span>
                    <span
                      className="font-mono text-[10px] uppercase text-muted-foreground"
                      style={{ letterSpacing: "0.12em" }}
                    >
                      {item.itemType}
                    </span>
                    <Check className="h-4 w-4 text-transparent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FirstRun({ onInvite }: { onInvite: () => void }) {
  const steps = [
    { n: "01", title: "Invite someone", body: "Add a person by email. Connecting alone shares nothing." },
    { n: "02", title: "Share an item", body: "Give a specific recipe or plan a live, read-only copy." },
    { n: "03", title: "Cook together", body: "They see your latest version; edits sync. They can save their own copy." }
  ];
  return (
    <div className="grid gap-10 py-6">
      <div className="mx-auto grid max-w-[640px] justify-items-center gap-4 text-center">
        <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[22px] bg-[color:var(--sage-soft)] text-[color:var(--sage-fg)]">
          <Share2 className="h-9 w-9" />
        </span>
        <h2
          className="font-serif text-[44px] leading-[0.95] text-foreground sm:text-[52px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          No one yet.
        </h2>
        <p className="max-w-[440px] text-[14.5px] leading-[1.55] text-muted-foreground">
          eeatly is <strong className="text-foreground">private by default</strong>. Invite the
          people you cook with, then share individual recipes and plans — one at a time, only when
          you choose.
        </p>
        <Button variant="default" className="mt-1 min-h-[40px]" onClick={onInvite}>
          <UserPlus className="h-3.5 w-3.5" />
          Invite someone
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="grid gap-2 rounded-[16px] border bg-[var(--surface)] p-5">
            <span
              className="font-mono text-[10.5px] uppercase text-muted-foreground"
              style={{ letterSpacing: "0.14em" }}
            >
              Step {s.n}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[color:var(--sage-soft)] text-[color:var(--sage-fg)]">
              <Plus className="h-4 w-4" />
            </span>
            <p className="text-[15px] font-semibold text-foreground">{s.title}</p>
            <p className="text-[12.8px] leading-[1.5] text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
