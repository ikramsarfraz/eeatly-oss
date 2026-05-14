import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PlanForm } from "@/components/plans/plan-form";

export const metadata: Metadata = {
  title: "New plan"
};

export default function NewPlanPage() {
  return (
    <div className="grid max-w-xl gap-4">
      <div>
        <Link
          href={"/plans" as Route}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All plans
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New plan</CardTitle>
          <CardDescription>
            Name an occasion and pick a date. You can add dishes once it&apos;s
            created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
