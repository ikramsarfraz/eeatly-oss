"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { MealLogForm } from "@/components/forms/meal-log-form";
import { SectionLabel } from "@/components/ui/section-label";
import { useSetTopBarActions } from "@/components/layout/top-bar-actions";

/**
 * Round 29 — Log a meal page.
 *
 * Editorial chrome around the existing `<MealLogForm>`. The form's
 * validation, photo-upload pipeline, AI suggest button, and submit
 * logic stay intact — only the visual shell changes. R29 adds two
 * tiny props to MealLogForm (`formId` + `hideSubmit`) so the page
 * can lift the submit affordance into the TopBar via the standard
 * HTML `<button type="submit" form={id}>` pattern.
 *
 * TopBar actions:
 *   - Cancel (outline, `router.back()`)
 *   - Save meal (forest, submits the form)
 *
 * Prefill: optional `?name=...` query param. R29 spec marks this as
 * the prefill mechanism for Home's Quick log → Log meal route.
 */

export function LogMealClient({
  initialMealName
}: {
  initialMealName?: string;
}) {
  const router = useRouter();
  const formId = React.useId();
  const externalFormId = `${formId}-log-meal`;

  const topBarActions = React.useMemo(
    () => (
      <>
        <Button
          variant="outline"
          className="min-h-[40px]"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form={externalFormId}
          variant="default"
          className="min-h-[40px]"
        >
          Save meal
        </Button>
      </>
    ),
    [externalFormId, router]
  );
  useSetTopBarActions(topBarActions);

  return (
    <div className="grid gap-7">
      <header className="grid gap-2">
        <h1
          className="font-serif text-[44px] leading-[1.02] text-foreground sm:text-[52px] lg:text-[56px]"
          style={{ letterSpacing: "-0.025em" }}
        >
          Log a meal.
        </h1>
        <p className="max-w-[560px] text-[14px] leading-[1.55] text-muted-foreground">
          What you cooked, when, how it went. Photos are optional — the
          honest log is what makes the kitchen remember.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          <SectionLabel>Details</SectionLabel>
          <MealLogForm
            formId={externalFormId}
            hideSubmit
            initialMealName={initialMealName}
            onSuccess={() => {
              // Land on Home; the dashboard meals list refetches the new
              // log. A future round can route to the freshly-created
              // meal's detail page once `createLog` returns the meal id
              // on the wire.
              router.push("/dashboard" as Route);
            }}
          />
        </div>

        <aside className="grid gap-4">
          <div
            className="grid gap-3 rounded-[14px] border bg-[color:var(--sage-soft)] p-5"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <SectionLabel>What gets remembered</SectionLabel>
            <ul className="grid gap-2 text-[13px] leading-[1.55] text-foreground/85">
              <li>· Cook count + last-cooked date roll up automatically.</li>
              <li>
                · Photos attach to the meal so future logs land on the
                same recipe.
              </li>
              <li>
                · Effort tags help the dashboard&apos;s &ldquo;Tonight&rdquo;
                rediscovery surface the right meal for the right night.
              </li>
            </ul>
          </div>
          {/* Auto-tagged chips card omitted — no backend produces
              meal-name-derived tags today. */}
        </aside>
      </div>
    </div>
  );
}
