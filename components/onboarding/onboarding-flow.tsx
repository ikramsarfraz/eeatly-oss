"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/toast-provider";
import {
  COOK_FREQUENCY_BUCKETS,
  type CookFrequencyBucket
} from "@/lib/validators/onboarding";
import { cn } from "@/lib/utils";
import type { EffortLevel } from "@/types";
import {
  completeOnboardingAction,
  saveOnboardingHabitsAction
} from "@/actions/onboarding";
import { createMealLogAction } from "@/actions/meals";

type Step = 1 | 2 | 3 | 4;

type Habits = {
  cooksPerWeek: number | null;
  weeknightEffort: EffortLevel | null;
};

const EFFORT_OPTIONS: { value: EffortLevel; label: string; helper: string }[] = [
  { value: "quick", label: "Quick", helper: "Under 15 min" },
  { value: "easy", label: "Easy", helper: "15–30 min" },
  { value: "medium", label: "Medium", helper: "30–60 min" },
  { value: "high_effort", label: "Project", helper: "An hour or more" }
];

export function OnboardingFlow({
  name,
  initialHabits
}: {
  name: string;
  initialHabits: Habits;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = React.useState<Step>(1);
  const [habits, setHabits] = React.useState<Habits>(initialHabits);
  const [firstMealName, setFirstMealName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleHabitsContinue() {
    if (habits.cooksPerWeek === null || habits.weeknightEffort === null) return;
    setPending(true);
    try {
      await saveOnboardingHabitsAction({
        cooksPerWeek: habits.cooksPerWeek,
        weeknightEffort: habits.weeknightEffort
      });
      setStep(3);
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't save",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setPending(false);
    }
  }

  async function handleLogFirstMeal() {
    const trimmed = firstMealName.trim();
    if (trimmed.length < 2) return;
    setPending(true);
    try {
      await createMealLogAction(
        {
          mealName: trimmed,
          effortLevel: habits.weeknightEffort ?? "easy",
          notes: "",
          cookedDate: new Date().toISOString().slice(0, 10),
          photoUrl: "",
          recipeText: "",
          recipeSourceUrl: ""
        },
        { source: "quick_log" }
      );
      setStep(4);
    } catch (error) {
      showToast({
        variant: "error",
        title: "Couldn't log that meal",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setPending(false);
    }
  }

  async function handleFinish() {
    setPending(true);
    try {
      // Server action redirects to /dashboard on success — control may not
      // return here.
      await completeOnboardingAction();
      router.replace("/dashboard");
    } catch {
      // redirect() throws a special NEXT_REDIRECT that we deliberately don't
      // catch separately — anything else lands us in the toast path.
      router.replace("/dashboard");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-[480px]">
      <CardContent className="grid gap-6 p-6 sm:p-8">
        <StepIndicator current={step} total={4} />

        {step === 1 ? (
          <StepWelcome
            name={name}
            onContinue={() => setStep(2)}
            pending={pending}
          />
        ) : null}

        {step === 2 ? (
          <StepHabits
            habits={habits}
            onChange={setHabits}
            onContinue={handleHabitsContinue}
            pending={pending}
          />
        ) : null}

        {step === 3 ? (
          <StepFirstMeal
            value={firstMealName}
            onChange={setFirstMealName}
            onLog={handleLogFirstMeal}
            onSkip={() => setStep(4)}
            pending={pending}
          />
        ) : null}

        {step === 4 ? (
          <StepDone onFinish={handleFinish} pending={pending} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < current ? "bg-primary" : "bg-[var(--surface-2)]"
          )}
        />
      ))}
    </div>
  );
}

function StepWelcome({
  name,
  onContinue,
  pending
}: {
  name: string;
  onContinue: () => void;
  pending: boolean;
}) {
  // Trim long names and avoid the awkward "eeatly user" greeting when no
  // name was inferable.
  const greeting = name && !name.startsWith("eeatly") ? `Hi ${name.split(" ")[0]},` : "Welcome,";
  return (
    <div className="grid gap-4">
      <span className="inline-flex w-fit items-center gap-[7px] rounded-full bg-[var(--primary-soft)] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
        <Sparkles className="h-3 w-3" />
        Welcome
      </span>
      <h1 className="font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em]">
        {greeting}
        <br />
        let&apos;s set up your <em className="italic text-primary">cooking memory.</em>
      </h1>
      <p className="text-[14px] leading-[1.55] text-muted-foreground">
        eeatly remembers what you cook and surfaces the right meal when
        you&apos;re tired of deciding. Three quick questions, then you&apos;re in.
      </p>
      <Button type="button" onClick={onContinue} disabled={pending} className="w-full">
        Let&apos;s go
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StepHabits({
  habits,
  onChange,
  onContinue,
  pending
}: {
  habits: Habits;
  onChange: (next: Habits) => void;
  onContinue: () => void;
  pending: boolean;
}) {
  const canContinue =
    habits.cooksPerWeek !== null && habits.weeknightEffort !== null && !pending;

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h2 className="font-serif text-[26px] font-normal leading-[1.15] tracking-[-0.005em]">
          A quick read on how you cook
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-muted-foreground">
          Helps us tune what we surface — no exact answer needed.
        </p>
      </header>

      <fieldset className="grid gap-3">
        <legend className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          How often do you cook?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {COOK_FREQUENCY_BUCKETS.map((bucket) => {
            const active = habits.cooksPerWeek === bucket.value;
            return (
              <button
                key={bucket.value}
                type="button"
                onClick={() =>
                  onChange({ ...habits, cooksPerWeek: bucket.value as CookFrequencyBucket })
                }
                aria-pressed={active}
                className={cn(
                  "grid gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-[var(--primary-soft)] text-foreground"
                    : "border-border bg-[var(--surface)] hover:border-[var(--border-strong)]"
                )}
              >
                <span className="text-[13px] font-medium">{bucket.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{bucket.helper}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Your weeknight default
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {EFFORT_OPTIONS.map((opt) => {
            const active = habits.weeknightEffort === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...habits, weeknightEffort: opt.value })}
                aria-pressed={active}
                className={cn(
                  "grid gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-[var(--primary-soft)] text-foreground"
                    : "border-border bg-[var(--surface)] hover:border-[var(--border-strong)]"
                )}
              >
                <span className="text-[13px] font-medium">{opt.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{opt.helper}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continue
        {!pending ? <ArrowRight className="h-4 w-4" /> : null}
      </Button>
    </div>
  );
}

function StepFirstMeal({
  value,
  onChange,
  onLog,
  onSkip,
  pending
}: {
  value: string;
  onChange: (v: string) => void;
  onLog: () => void;
  onSkip: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h2 className="font-serif text-[26px] font-normal leading-[1.15] tracking-[-0.005em]">
          What did you cook recently?
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-muted-foreground">
          One real meal gets eeatly useful. Skip if you&apos;d rather start fresh.
        </p>
      </header>

      <div className="grid gap-2">
        <label
          htmlFor="firstMealName"
          className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
        >
          Meal name
        </label>
        <Input
          id="firstMealName"
          placeholder="Lemon herb chicken bowls"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={pending}
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          onClick={onLog}
          disabled={pending || value.trim().length < 2}
          className="w-full"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Log it
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={pending}
          className="w-full"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function StepDone({ onFinish, pending }: { onFinish: () => void; pending: boolean }) {
  return (
    <div className="grid gap-4">
      <span className="inline-flex w-fit items-center gap-[7px] rounded-full bg-[var(--primary-soft)] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
        <Sparkles className="h-3 w-3" />
        You&apos;re set
      </span>
      <h2 className="font-serif text-[30px] font-normal leading-[1.1] tracking-[-0.01em]">
        Ready when you are.
      </h2>
      <p className="text-[14px] leading-[1.55] text-muted-foreground">
        Log a meal each time you cook. eeatly will start surfacing ideas
        worth bringing back after a few logs.
      </p>
      <Button type="button" onClick={onFinish} disabled={pending} className="w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Open eeatly
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
