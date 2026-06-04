import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PlanForm } from "@/components/plans/plan-form";

export const metadata: Metadata = {
  title: "New plan"
};

export default function NewPlanPage() {
  return (
    // Single centered column. The breadcrumb in the top bar is the only
    // back affordance — no in-page "← All plans" link.
    <div className="mx-auto grid w-full max-w-[620px] gap-6 pt-3">
      <header className="grid gap-2">
        <p
          className="font-mono text-[10.5px] uppercase text-[color:var(--terra-fg)]"
          style={{ letterSpacing: "0.16em" }}
        >
          Plan · New
        </p>
        <h1
          className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[56px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          New plan
        </h1>
        <p className="max-w-[520px] text-[14px] leading-[1.55] text-muted-foreground">
          Name an occasion and pick a date. You&apos;ll add dishes, notes, and cooks once it&apos;s
          created.
        </p>
      </header>
      <Card className="p-6 sm:p-[26px]">
        <PlanForm mode="create" />
      </Card>
    </div>
  );
}
