"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
import { useToast } from "@/components/providers/toast-provider";
import { trpc } from "@/lib/trpc/client";
import { GATE_RULES, type GateRule } from "@/lib/gates/rules";

export type OverridePanelRow = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  cohort: string | null;
  ruleOverride: GateRule;
  createdAt: string;
};

type Props = {
  feature: string;
  overrides: OverridePanelRow[];
};

type Target = "user" | "cohort";

export function FeatureOverridesPanel({ feature, overrides }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [target, setTarget] = React.useState<Target>("user");
  const [userId, setUserId] = React.useState("");
  const [cohort, setCohort] = React.useState("");
  const [rule, setRule] = React.useState<GateRule>("open");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const createMutation = trpc.admin.createGateOverride.useMutation();
  const deleteMutation = trpc.admin.deleteGateOverride.useMutation();
  const pending = createMutation.isPending;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    try {
      await createMutation.mutateAsync({
        feature,
        ruleOverride: rule,
        userId: target === "user" ? userId.trim() : undefined,
        cohort: target === "cohort" ? cohort.trim() : undefined
      });
      showToast({ variant: "success", title: "Override saved" });
      setUserId("");
      setCohort("");
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't save override",
        description: error instanceof Error ? error.message : undefined
      });
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ overrideId: id });
      showToast({ variant: "success", title: "Override removed" });
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't remove",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <section className="rounded-lg border bg-background/60 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Add override
        </h2>
        <form onSubmit={handleCreate} className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="target">Target</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger id="target" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="cohort">Cohort</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="targetId">
              {target === "user" ? "User id" : "Cohort name"}
            </Label>
            {target === "user" ? (
              <Input
                id="targetId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_…"
                autoComplete="off"
              />
            ) : (
              <Input
                id="targetId"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                placeholder="beta_2026"
                autoComplete="off"
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rule">Rule</Label>
            <Select value={rule} onValueChange={(v) => setRule(v as GateRule)}>
              <SelectTrigger id="rule" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GATE_RULES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Active overrides ({overrides.length})
        </h2>
        {overrides.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
            No overrides — every user is on the default rule.
          </p>
        ) : (
          <ul className="grid gap-2">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {o.userId ? (
                      <span className="font-medium">
                        {o.userName ?? "(unnamed)"}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {o.userEmail ?? "no email"}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium">cohort: {o.cohort}</span>
                    )}
                    <span className="rounded-full border bg-[var(--surface-2)] px-2 py-0.5 font-mono-brand text-[10.5px] text-muted-foreground">
                      {o.ruleOverride}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">added {o.createdAt}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === o.id}
                      aria-label="Remove override"
                    >
                      {deletingId === o.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this override?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The target falls back to the feature&apos;s default rule.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(o.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
