"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingRow } from "@/components/settings/setting-row";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";

/**
 * R32 — Account "Profile" card with a per-card edit mode (handoff variant F).
 *
 * View state: read-only Name + Email rows (Email carries a Locked chip).
 * Edit state (toggled by the header Edit button): Name becomes a text input
 * (autofocus); Email stays a locked, read-only static field — it's the
 * sign-in / recovery identity and must change through a verified flow
 * elsewhere, never an inline edit. Save is disabled until the name is dirty.
 */
export function AccountCard({
  initialName,
  email
}: {
  initialName: string;
  email: string;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [savedName, setSavedName] = React.useState(initialName);
  const [name, setName] = React.useState(initialName);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== savedName;

  const update = trpc.auth.updateName.useMutation({
    onSuccess: (res) => {
      setSavedName(res.name);
      setName(res.name);
      setEditing(false);
      showToast({ variant: "success", title: "Profile updated" });
      // Re-fetch server components (sidebar avatar, etc.) now that Better
      // Auth has refreshed the session with the new name.
      router.refresh();
    },
    onError: (e) => showToast({ variant: "error", title: "Couldn't save", description: e.message })
  });

  function startEdit() {
    setName(savedName);
    setEditing(true);
  }
  function cancel() {
    setName(savedName);
    setEditing(false);
  }
  function save() {
    if (dirty && !update.isPending) update.mutate({ name: trimmed });
  }

  const lockedChip = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-muted-foreground"
      style={{ letterSpacing: "0.1em" }}
    >
      <Lock className="h-3 w-3" />
      Locked
    </span>
  );

  return (
    <Card className="overflow-hidden p-0">
      {/* Card header — block label + per-card Edit toggle. */}
      <div className="flex items-center justify-between border-b border-[var(--border-soft,var(--border))] px-5 py-3.5">
        <span
          className="font-mono text-[10px] font-semibold uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          Profile
        </span>
        {!editing ? (
          <Button variant="ghost" size="sm" className="h-8" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
      </div>

      {!editing ? (
        <>
          <SettingRow label="Name" value={savedName} />
          <SettingRow label="Email" value={email} sub="Used to sign in." suffix={lockedChip} last />
        </>
      ) : (
        <div className="grid gap-4 px-5 py-5">
          <div className="grid gap-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              autoFocus
              value={name}
              maxLength={80}
              disabled={update.isPending}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5">
              <span className="truncate text-[14px] text-muted-foreground">{email}</span>
              {lockedChip}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Your sign-in email can&apos;t be changed here.
            </p>
          </div>
        </div>
      )}

      {editing ? (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-soft,var(--border))] bg-[var(--surface-2)] px-5 py-3">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={update.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
