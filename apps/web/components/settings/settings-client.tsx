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
  Mail,
  Pencil,
  Sparkles,
  Trash2,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionLabel } from "@/components/ui/section-label";
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
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { CreditsCard } from "@/components/settings/credits-card";
import { PlanManager } from "@/components/settings/plan-manager";

const DELETE_CONFIRMATION_PHRASE = "delete my account";

/**
 * Round 31 — Settings page editorial rewrite.
 *
 * 200px jump-nav + 7 sections (Account / Plan / Kitchen / Notifications
 * / Appearance / Advanced / Danger zone). The R23 card-list layout is
 * gone; each section is now a single Card with `<SettingRow>`
 * children for consistency.
 *
 * Active jump-nav state: scroll-driven via `IntersectionObserver`.
 * Click also nudges the active state immediately so taps feel
 * responsive even before the scroll settles.
 *
 * The R23 `<SubscriptionCard>` / `<HouseholdCard>` /
 * `<DeleteAccountCard>` / `<PreferencesCard>` cards no longer
 * render — their content lives inside the new sections as Rows. The
 * underlying trpc calls (`auth.deleteAccount`, `billing.createPortalSession`,
 * `households.*`) all stay in their existing components and are
 * invoked directly from the new Rows where needed.
 */

type SectionId =
  | "account"
  | "plan"
  | "sharing"
  | "kitchen"
  | "notifications"
  | "appearance"
  | "advanced"
  | "danger";

const SECTIONS: ReadonlyArray<{ id: SectionId; label: string; danger?: boolean }> = [
  { id: "account", label: "Account" },
  { id: "plan", label: "Plan" },
  { id: "sharing", label: "Sharing & privacy" },
  { id: "kitchen", label: "Kitchen" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "advanced", label: "Advanced" },
  { id: "danger", label: "Danger zone", danger: true }
];

type SettingsClientProps = {
  user: { name: string; email: string };
  household: { name: string };
  memberCount: number;
  pendingInviteCount: number;
  /** Owner pointer — currently unused by the rendered Settings UI
   *  (member management has moved to `/household`) but retained on the
   *  prop shape so callers can pass it through and future owner-only
   *  affordances (transfer ownership, billing seats) can light up
   *  without a server-shell change. */
  isOwner: boolean;
  isPlus: boolean;
  /**
   * Release-v1 launch promo. When true (and the user has no paid
   * subscription), Plus is unlocked for free during launch — the Plan
   * section reads as Plus with a "free during launch" note rather than
   * the gated Free copy.
   */
  launchMode: boolean;
  version: string;
};

export function SettingsClient({
  user,
  household,
  memberCount,
  pendingInviteCount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see prop comment
  isOwner: _isOwner,
  // isPlus / launchMode are now resolved live inside <PlanManager/>.
  version
}: SettingsClientProps) {
  const [active, setActive] = React.useState<SectionId>("account");

  // IntersectionObserver for scroll-driven active state. Each section
  // anchor reports when it enters / leaves the viewport; we pick the
  // section whose top is closest-but-still-above the center as the
  // active one. Cheap to compute; no continuous scroll listener
  // needed.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({
            id: e.target.id as SectionId,
            top: e.boundingClientRect.top
          }))
          .sort((a, b) => a.top - b.top);
        if (visible[0]) setActive(visible[0].id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function handleNavClick(id: SectionId) {
    setActive(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="grid gap-7">
      {/* Header band */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1
          className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[64px]"
          style={{ letterSpacing: "-0.025em" }}
        >
          Settings.
        </h1>
        <span
          className="font-mono text-[10.5px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.14em" }}
        >
          eeatly · v{version}
        </span>
      </header>

      {/* Two-column grid — 200px jump-nav + 1fr sections */}
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Jump-nav (sticky on lg+) */}
        <nav
          aria-label="Settings sections"
          className="lg:sticky lg:top-[calc(var(--header-h)_+_16px)] lg:self-start"
        >
          <ul className="grid gap-1">
            {SECTIONS.map((section) => {
              const isActive = active === section.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(section.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors",
                      isActive && !section.danger
                        ? "bg-[color:var(--sage-soft)] font-semibold text-primary"
                        : isActive && section.danger
                          ? "bg-[color:var(--danger-soft)] font-semibold text-[color:var(--danger-fg)]"
                          : section.danger
                            ? "text-[color:var(--danger-fg)] hover:bg-[color:var(--danger-soft)]/60"
                            : "text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground"
                    )}
                  >
                    {section.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sections — max-width clamped so long lines stay readable */}
        <div className="grid max-w-[740px] gap-8">
          <section id="account" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Account</SectionLabel>
            <Card className="overflow-hidden p-0">
              <SettingRow
                label="Name"
                value={user.name}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                    title="Edit name (coming soon)"
                    disabled
                    aria-disabled
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <SettingRow
                label="Email"
                value={user.email}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                    title="Edit email (coming soon)"
                    disabled
                    aria-disabled
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                }
                last
              />
            </Card>
          </section>

          <PlanManager />

          <CreditsCard />

          <section id="sharing" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Sharing &amp; privacy</SectionLabel>
            <Card className="overflow-hidden p-0">
              <SettingRow
                label="New recipes &amp; plans are private"
                sub="Everything you create starts visible to only you. This can't be turned off — sharing is always an explicit, per-item choice."
                suffix={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--sage-soft)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-[color:var(--primary)]" style={{ letterSpacing: "0.1em" }}>
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
              Revoking access removes someone&apos;s <strong className="text-foreground">live copy</strong>{" "}
              instantly. If they saved their own copy, that copy stays theirs. Manage who can see a
              specific item from that recipe or plan&apos;s <strong className="text-foreground">Share</strong>{" "}
              sheet.
            </p>
          </section>

          <section id="kitchen" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Kitchen</SectionLabel>
            <Card className="overflow-hidden p-0">
              <SettingRow
                label="Members &amp; invitations"
                sub={
                  <>
                    {memberCount === 1
                      ? "Just you"
                      : `${memberCount} members`}{" "}
                    · {pendingInviteCount}{" "}
                    {pendingInviteCount === 1
                      ? "pending invite"
                      : "pending invites"}
                    .
                  </>
                }
                suffix={
                  <Button asChild variant="ghost" size="sm" className="h-9">
                    <Link href={"/household" as Route}>
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
                value={household.name}
              />
              <KitchenUnits />
            </Card>
          </section>

          <section id="notifications" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Notifications</SectionLabel>
            <Card className="overflow-hidden p-0">
              <SettingRow
                label="Notifications"
                sub="Coming soon — alerts when co-cooks log meals, plans approach, pending invites expire."
                last
              />
            </Card>
          </section>

          <section id="appearance" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Appearance</SectionLabel>
            <Card className="overflow-hidden p-0">
              <SettingRow
                label="Theme"
                sub="Light follows your editorial cream. Dark uses a warm near-black. System tracks your OS."
                suffix={<ThemeToggle />}
                last
              />
            </Card>
          </section>

          <section id="advanced" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Advanced</SectionLabel>
            <Card className="overflow-hidden p-0">
              <SettingRow
                label="Developer settings"
                sub="Diagnostics, experimental flags, data sync controls. Lands when we have something to surface here."
                last
              />
            </Card>
          </section>

          <section id="danger" className="grid gap-3 scroll-mt-24">
            <SectionLabel>Danger zone</SectionLabel>
            <Card className="overflow-hidden border-[color:var(--danger-soft)] p-0">
              <SettingRow
                label="Export your data"
                sub="Download everything in your kitchen — meals, logs, plans, annotations — as JSON."
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
          </section>

          {/* Hidden — currently unused affordances kept on the page
              for compatibility with existing keyboard shortcut / link
              targets. Sign-out + Feedback + Privacy/Help links live
              in the user menu / public routes. */}
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Privacy ·{" "}
            <Link href={"/privacy" as Route} className="underline-offset-2 hover:underline">
              privacy policy
            </Link>{" "}
            · Help ·{" "}
            <Link href={"/help" as Route} className="underline-offset-2 hover:underline">
              help center
            </Link>
          </p>
        </div>
      </div>

      {/* Suppress unused-import warnings for icons / utilities the
          subcomponents may pick up later. */}
      <span hidden aria-hidden>
        <Mail className="h-0 w-0" />
        <Sparkles className="h-0 w-0" />
      </span>
    </div>
  );
}

/**
 * Inline delete-account row — keeps the existing
 * `trpc.auth.deleteAccount` flow but renders inside the new Card +
 * SettingRow shape. The procedure requires a `confirmationPhrase`
 * input (existing R4 invariant), so we use shadcn `Dialog` + `Input`
 * rather than `AlertDialog` to gate the destructive action behind a
 * typed confirmation. Behavior mirrors the R23 `<DeleteAccountCard>`:
 * - OWNER_BLOCK → polite error toast pointing at ownership transfer.
 * - On success → `window.location.assign(result.redirectTo)` so the
 *   cleared Better Auth cookie takes effect on the next page load.
 */
function DeleteAccountRow() {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const deleteMut = trpc.auth.deleteAccount.useMutation();
  const pending = deleteMut.isPending;
  const phraseMatches =
    phrase.trim().toLowerCase() === DELETE_CONFIRMATION_PHRASE;

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
            "You own a kitchen with other members. Transfer ownership before deleting — for now, contact support to make the change."
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
            <Button
              variant="destructive"
              size="sm"
              className="h-9"
              disabled={pending}
            >
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
                This permanently removes your eeatly account, the meals
                you&apos;ve logged, plans you own, and any kitchens you
                own. Co-cooks lose access. There&apos;s no undo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="confirm-delete-phrase">
                Type{" "}
                <span className="font-mono-brand text-foreground">
                  {DELETE_CONFIRMATION_PHRASE}
                </span>{" "}
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
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

/** Active "anyone with the link" recipe shares — copy + revoke. */
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
      {links.map((link, i) => (
        <div
          key={link.shareId}
          className={cn(
            "flex flex-wrap items-center gap-3 px-5 py-4",
            i > 0 && "border-t border-[var(--border-soft,var(--border))]"
          )}
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

/**
 * Units preference (Settings → Kitchen). Shares the `privacySettings`
 * query/mutation with PrivacyToggles since both live on the user_settings
 * row. The default is inferred once at signup from the request's geo/locale
 * (see lib/units/detect.ts); this is the flip. It biases the AI on capture
 * + Refine — existing recipes are not retroactively converted.
 */
function KitchenUnits() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const query = trpc.sharing.privacySettings.useQuery();
  const update = trpc.sharing.updatePrivacySettings.useMutation({
    onSuccess: () => void utils.sharing.privacySettings.invalidate(),
    onError: (e) =>
      showToast({ variant: "error", title: "Couldn't save", description: e.message })
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
          onChange={(v) =>
            update.mutate({ measurementSystem: v as "metric" | "imperial" })
          }
        />
      }
      last
    />
  );
}

function Toggle({
  on,
  busy,
  onToggle
}: {
  on: boolean;
  busy: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onToggle(!on)}
      className={cn(
        "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60",
        on ? "bg-[color:var(--primary)]" : "bg-[var(--border-strong,var(--border))]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
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
