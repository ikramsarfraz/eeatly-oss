import Link from "next/link";
import type { Route } from "next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_REGISTRY, type FeatureKey } from "@eeatly/api/gates/registry";

type UpgradePromptProps = {
  feature: FeatureKey;
  /** Optional override copy. Default pulls the feature's description. */
  description?: string;
};

/**
 * Inline upgrade prompt rendered as `<Gated>` fallback when the user
 * can't reach a feature. Tasteful — small inline card with the
 * feature's description and a single CTA to /pricing. Not a modal,
 * not naggy.
 */
export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  const copy = description ?? FEATURE_REGISTRY[feature].description;
  return (
    <div
      className="grid gap-2 rounded-lg border border-dashed bg-background/60 p-4 text-sm"
      role="status"
    >
      <div className="flex items-center gap-1.5 text-foreground">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-medium">eeatly Plus</span>
      </div>
      <p className="text-muted-foreground">
        {copy} is part of <strong className="text-foreground">eeatly Plus</strong>.
      </p>
      <div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={"/pricing" as Route}>Learn more</Link>
        </Button>
      </div>
    </div>
  );
}
