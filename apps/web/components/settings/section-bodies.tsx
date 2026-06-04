"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Download,
  Link2,
  Loader2,
  Lock,
  Trash2,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";
import { cn } from "@/lib/utils";
import { SettingRow } from "@/components/settings/setting-row";

const DELETE_CONFIRMATION_PHRASE = "delete my account";

/* ─── Sharing & privacy ─────────────────────────────────────────── */

export function SharingSection() {
  return (
    <>
      <Card className="overflow-hidden p-0">
        <SettingRow
          label="New recipes & plans are private"
          sub="Everything you create starts visible to only you. This can't be turned off; sharing is always an explicit, per-item choice."
          suffix={
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--sage-soft)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-[color:var(--primary)]"
              style={{ letterSpacing: "0.1em" }}
            >
              <Lock className="h-3 w-3" />
              Always on
            </span>
          }
          last
        />
      </Card>
      <PrivacyToggles />
      <ActiveShareLinks />
      <p className="text-[12.5px] leading-[1.55] text-muted-foreground">
        Revoking a link removes the{" "}
        <strong className="text-foreground">live copy</strong>{" "}
        instantly. If someone saved their own copy, that copy stays theirs. To change who can
        see a specific recipe or plan, open its{" "}
        <strong className="text-foreground">Share</strong> sheet.
      </p>
    </>
  );
}

/** Global sharing & privacy toggles + the who-can-add-you segmented radio. */
function PrivacyToggles() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const query = trpc.sharing.privacySettings.useQuery();
  const update = trpc.sharing.updatePrivacySettings.useMutation({
    onSuccess: () => void utils.sharing.privacySettings.invalidate(),
    onError: (e) => showToast({ variant: "error", title: "Couldn't save", description: e.message })
  });
  const s = query.data;
  if (!s) return null;

  return (
    <Card className="overflow-hidden p-0">
      <SettingRow
        label="Allow “anyone with the link”"
        sub="Lets you create read-only link views for people without an eeatly account. Turn off to restrict sharing to named people only."
        suffix={
          <Toggle
            on={s.allowLinkShares}
            busy={update.isPending}
            onToggle={(v) => update.mutate({ allowLinkShares: v })}
          />
        }
      />
      <SettingRow
        label="Co-cooks can re-share my items"
        sub="If off, only you can grant access to recipes and plans you own."
        suffix={
          <Toggle
            on={s.cooksCanReshare}
            busy={update.isPending}
            onToggle={(v) => update.mutate({ cooksCanReshare: v })}
          />
        }
      />
      <SettingRow
        label="Who can add you to their kitchen"
        sub="Controls who can send you a connection invite."
        suffix={
          <SegmentedRadio
            value={s.whoCanAddYou}
            options={[
              { value: "anyone", label: "Anyone" },
              { value: "connections", label: "Shared-with" },
              { value: "no_one", label: "No one" }
            ]}
            busy={update.isPending}
            onChange={(v) =>
              update.mutate({ whoCanAddYou: v as "anyone" | "connections" | "no_one" })
            }
          />
        }
      />
      <SettingRow
        label="Find me by email"
        sub="Whether people who know your email can discover and connect with you."
        suffix={
          <Toggle
            on={s.findByEmail}
            busy={update.isPending}
            onToggle={(v) => update.mutate({ findByEmail: v })}
          />
        }
        last
      />
    </Card>
  );
}

/** Active "anyone with the link" recipe/plan shares — copy + revoke. */
function ActiveShareLinks() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const linksQuery = trpc.sharing.activeShareLinks.useQuery();
  const links = linksQuery.data ?? [];
  const onRevoked = () => {
    void utils.sharing.activeShareLinks.invalidate();
    showToast({ variant: "success", title: "Link revoked" });
  };
  const onRevokeError = (e: { message: string }) =>
    showToast({ variant: "error", title: "Couldn't revoke", description: e.message });
  const revokeRecipe = trpc.shares.revoke.useMutation({ onSuccess: onRevoked, onError: onRevokeError });
  const revokePlan = trpc.shares.revokePlan.useMutation({ onSuccess: onRevoked, onError: onRevokeError });
  const revokeBusy = revokeRecipe.isPending || revokePlan.isPending;

  if (linksQuery.isLoading) return null;
  if (links.length === 0) {
    return (
      <Card className="overflow-hidden p-0">
        <SettingRow
          label="Active share links"
          sub="You have no public recipe links. Turn on “anyone with the link” from a recipe's Share sheet to create one."
          last
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-5 pt-4 pb-3">
        <p className="text-[14px] font-medium text-foreground">Active share links</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-muted-foreground">
          Public &ldquo;anyone with the link&rdquo; shares. Sharing with specific people is
          managed from each item&apos;s Share sheet, not here.
        </p>
      </div>
      {links.map((link) => (
        <div
          key={link.shareId}
          className="flex flex-wrap items-center gap-3 border-t border-[var(--border-soft,var(--border))] px-5 py-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-2)] text-muted-foreground">
            <Link2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground">
              {link.name}
              <span className="ml-2 font-mono text-[9.5px] uppercase text-muted-foreground">
                {link.itemType}
              </span>
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{link.url}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              void navigator.clipboard?.writeText(link.url);
              showToast({ variant: "success", title: "Link copied" });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-[color:var(--danger,#b4472e)]"
            disabled={revokeBusy}
            onClick={() =>
              link.itemType === "plan"
                ? revokePlan.mutate({ shareId: link.shareId })
                : revokeRecipe.mutate({ shareId: link.shareId })
            }
          >
            Revoke
          </Button>
        </div>
      ))}
    </Card>
  );
}

/* ─── Kitchen ───────────────────────────────────────────────────── */

export function KitchenSection({
  memberCount,
  pendingInviteCount,
  householdName
}: {
  memberCount: number;
  pendingInviteCount: number;
  householdName: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <SettingRow
        label="Members & invitations"
        sub="The people you cook with. Manage members, roles, and invitations."
        value={`${memberCount} ${memberCount === 1 ? "member" : "members"}${
          pendingInviteCount > 0 ? ` · ${pendingInviteCount} pending` : ""
        }`}
        suffix={
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={"/kitchen" as Route}>
              <Users className="h-3.5 w-3.5" />
              Manage
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />
      <SettingRow
        label="Default kitchen"
        sub="Where new logs and meals land."
        value={householdName}
      />
      <KitchenUnits />
    </Card>
  );
}

/**
 * Units preference. Shares the `privacySettings` query/mutation with
 * PrivacyToggles since both live on the user_settings row. Biases the AI on
 * capture + Refine — existing recipes are not retroactively converted.
 */
function KitchenUnits() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const query = trpc.sharing.privacySettings.useQuery();
  const update = trpc.sharing.updatePrivacySettings.useMutation({
    onSuccess: () => void utils.sharing.privacySettings.invalidate(),
    onError: (e) => showToast({ variant: "error", title: "Couldn't save", description: e.message })
  });
  const system = query.data?.measurementSystem;
  if (!system) return null;

  return (
    <SettingRow
      label="Units"
      sub="Which measurements new AI-filled recipes use. Existing recipes keep their original units."
      suffix={
        <SegmentedRadio
          value={system}
          options={[
            { value: "metric", label: "Metric" },
            { value: "imperial", label: "Imperial" }
          ]}
          busy={update.isPending}
          onChange={(v) => update.mutate({ measurementSystem: v as "metric" | "imperial" })}
        />
      }
      last
    />
  );
}

/* ─── Danger zone ───────────────────────────────────────────────── */

export function DangerSection() {
  return (
    <Card className="overflow-hidden border-[color:var(--danger-soft)] p-0">
      <SettingRow
        label="Export your data"
        sub="Download everything in your kitchen (meals, logs, plans, annotations) as JSON."
        suffix={
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled
            aria-disabled
            title="Export coming soon"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        }
        danger
      />
      <DeleteAccountRow />
    </Card>
  );
}

/**
 * Inline delete-account row — keeps the `trpc.auth.deleteAccount` flow behind
 * a typed confirmation dialog. OWNER_BLOCK → polite error toast; on success →
 * `window.location.assign(result.redirectTo)` so the cleared Better Auth
 * cookie takes effect on the next load.
 */
function DeleteAccountRow() {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const deleteMut = trpc.auth.deleteAccount.useMutation();
  const pending = deleteMut.isPending;
  const phraseMatches = phrase.trim().toLowerCase() === DELETE_CONFIRMATION_PHRASE;

  async function handleConfirm() {
    if (!phraseMatches) return;
    try {
      const result = await deleteMut.mutateAsync({ confirmationPhrase: phrase });
      window.location.assign(result.redirectTo);
    } catch (error) {
      const cause = getCause(error);
      if (cause?.reason === "OWNER_BLOCK") {
        showToast({
          variant: "error",
          title: "Can't delete your account yet",
          description:
            "You own a kitchen with other members. Transfer ownership before deleting; for now, contact support to make the change."
        });
        return;
      }
      showToast({
        variant: "error",
        title: "Couldn't delete your account",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  return (
    <SettingRow
      label="Delete account"
      sub="Permanently removes your account, your meal history, and any kitchens you own (transfer ownership first if you have co-cooks). Cannot be undone."
      suffix={
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setPhrase("");
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="h-9" disabled={pending}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[color:var(--danger-fg)]" />
                Delete this account?
              </DialogTitle>
              <DialogDescription>
                This permanently removes your eeatly account, the meals you&apos;ve logged, plans you
                own, and any kitchens you own. Co-cooks lose access. There&apos;s no undo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="confirm-delete-phrase">
                Type{" "}
                <span className="font-mono-brand text-foreground">{DELETE_CONFIRMATION_PHRASE}</span>{" "}
                to confirm.
              </Label>
              <Input
                id="confirm-delete-phrase"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={DELETE_CONFIRMATION_PHRASE}
                autoComplete="off"
                disabled={pending}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Keep account
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!phraseMatches || pending}
                className="bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:bg-[color:var(--destructive)]/90"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
      danger
      last
    />
  );
}

/* ─── Shared controls ───────────────────────────────────────────── */

function Toggle({
  on,
  busy,
  onToggle
}: {
  on: boolean;
  busy: boolean;
  onToggle: (v: boolean) => void;
}) {
  return <Switch checked={on} disabled={busy} onCheckedChange={onToggle} />;
}

function SegmentedRadio({
  value,
  options,
  busy,
  onChange
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  busy: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-[10px] border bg-[var(--surface-2)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={busy}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[8px] px-2.5 py-1 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-[var(--surface)] text-foreground shadow-[var(--shadow-sm)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
