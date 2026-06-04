import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import {
  COOK_FREQUENCY_BUCKETS,
  type CookFrequencyBucket
} from "@eeatly/api/validators/onboarding";
import { useThemeColors } from "../../lib/design/use-theme-colors";
import { trpc } from "../../lib/trpc";
import {
  Button,
  Card,
  PageTitle,
  Screen,
  SectionLabel
} from "../../components/ui";

/**
 * Round 24 — mobile onboarding.
 *
 * Mirrors `apps/web/components/onboarding/onboarding-flow.tsx` "fresh"
 * path: welcome → habits → first meal (optional) → done. The "invited"
 * branch web detects via `resolveOnboardingPath` isn't ported — mobile
 * users who arrive via an invite-link land in the same flow and skip
 * the first-meal step organically (the kitchen already has content;
 * skipping is one tap).
 *
 * Gating lives in `(authed)/_layout.tsx`: until `onboarding.status`
 * returns `completed: true`, the layout redirects here. The success
 * path navigates back to `/home` and lets the query invalidate so the
 * gate sees the new state on the next mount.
 *
 * Analytics fire `analytics.trackUserEvent({ name: "completed_onboarding" })`
 * matching web's event name exactly so the funnel doesn't fork.
 */

type EffortValue = "quick" | "easy" | "medium" | "high_effort";

type Habits = {
  cooksPerWeek: number | null;
  weeknightEffort: EffortValue | null;
};

const EFFORT_OPTIONS: { value: EffortValue; label: string; helper: string }[] = [
  { value: "quick", label: "Quick", helper: "Under 15 min" },
  { value: "easy", label: "Easy", helper: "15–30 min" },
  { value: "medium", label: "Medium", helper: "30–60 min" },
  { value: "high_effort", label: "Project", helper: "An hour or more" }
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [habits, setHabits] = useState<Habits>({
    cooksPerWeek: null,
    weeknightEffort: null
  });
  const [firstMealName, setFirstMealName] = useState("");
  const utils = trpc.useUtils();

  const saveHabitsMut = trpc.onboarding.saveHabits.useMutation();
  const completeMut = trpc.onboarding.complete.useMutation();
  const trackMut = trpc.analytics.trackUserEvent.useMutation();
  const createLogMut = trpc.meals.createLog.useMutation();

  async function handleHabitsContinue() {
    if (habits.cooksPerWeek === null || habits.weeknightEffort === null) return;
    try {
      await saveHabitsMut.mutateAsync({
        cooksPerWeek: habits.cooksPerWeek,
        weeknightEffort: habits.weeknightEffort
      });
      setStep(3);
    } catch {
      // Saving habits is best-effort — the user can re-try by re-tapping
      // Continue. We don't surface an error toast because the mobile
      // toast surface isn't mounted on this layer.
    }
  }

  async function handleLogFirstMeal() {
    const trimmed = firstMealName.trim();
    if (trimmed.length < 2) return;
    try {
      await createLogMut.mutateAsync({
        log: {
          mealName: trimmed,
          effortLevel: habits.weeknightEffort ?? "easy",
          notes: "",
          cookedDate: new Date().toISOString().slice(0, 10),
          photoUrl: "",
          recipeText: "",
          recipeSourceUrl: ""
        },
        source: "quick_log"
      });
      setStep(4);
    } catch {
      // Same: the user can re-try. Skip remains available.
    }
  }

  async function handleFinish() {
    try {
      await completeMut.mutateAsync();
    } catch {
      // The procedure marks completion best-effort; whatever happens,
      // we still want to flip the gate so the user lands in tabs.
    }
    // Fire the analytics event matching web's name exactly.
    trackMut.mutate(
      { name: "completed_onboarding", metadata: { source: "mobile_multi_step_flow" } },
      { onError: () => undefined }
    );
    // Invalidate the gate query so `_layout`'s next mount sees the
    // updated status, then push to home.
    await utils.onboarding.status.invalidate();
    router.replace("/(authed)/home");
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 40
          }}
          keyboardShouldPersistTaps="handled"
        >
          <StepIndicator current={step} total={4} colors={colors} />
          <View style={{ height: 24 }} />

          {step === 1 ? (
            <StepWelcome onContinue={() => setStep(2)} />
          ) : null}

          {step === 2 ? (
            <StepHabits
              habits={habits}
              onChange={setHabits}
              onContinue={handleHabitsContinue}
              pending={saveHabitsMut.isPending}
            />
          ) : null}

          {step === 3 ? (
            <StepFirstMeal
              value={firstMealName}
              onChange={setFirstMealName}
              onLog={handleLogFirstMeal}
              onSkip={() => setStep(4)}
              pending={createLogMut.isPending}
            />
          ) : null}

          {step === 4 ? (
            <StepDone
              onFinish={handleFinish}
              pending={completeMut.isPending}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StepIndicator({
  current,
  total,
  colors
}: {
  current: number;
  total: number;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={{ flexDirection: "row", gap: 6 }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 99,
            backgroundColor: i < current ? colors.forest : colors.surface,
            borderWidth: i < current ? 0 : 1,
            borderColor: colors.borderSoft
          }}
        />
      ))}
    </View>
  );
}

function StepWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={{ gap: 18 }}>
      <PageTitle
        kicker="Welcome"
        title="Let's set up your cooking memory."
        size="md"
        subtitle="eeatly remembers what you cook and surfaces the right meal when you're tired of deciding. A couple of quick questions, then you're in."
      />
      <Button onPress={onContinue} fullWidth size="lg">
        Let&apos;s go
      </Button>
    </View>
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
    <View style={{ gap: 22 }}>
      <PageTitle
        title="A quick read on how you cook."
        size="sm"
        subtitle="Helps us tune what we surface. No exact answer needed."
      />

      <View style={{ gap: 10 }}>
        <SectionLabel>How often do you cook?</SectionLabel>
        <OptionGrid
          options={COOK_FREQUENCY_BUCKETS.map((b) => ({
            value: b.value,
            label: b.label,
            helper: b.helper
          }))}
          selected={habits.cooksPerWeek}
          onSelect={(v) =>
            onChange({ ...habits, cooksPerWeek: v as CookFrequencyBucket })
          }
        />
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>Your weeknight default</SectionLabel>
        <OptionGrid
          options={EFFORT_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            helper: o.helper
          }))}
          selected={habits.weeknightEffort}
          onSelect={(v) => onChange({ ...habits, weeknightEffort: v as EffortValue })}
        />
      </View>

      <Button
        onPress={onContinue}
        disabled={!canContinue}
        loading={pending}
        fullWidth
        size="lg"
      >
        Continue
      </Button>
    </View>
  );
}

function OptionGrid<T extends string | number>({
  options,
  selected,
  onSelect
}: {
  options: { value: T; label: string; helper?: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flexBasis: "48%",
              flexGrow: 1,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: active ? colors.forest : colors.border,
              backgroundColor: active ? colors.sageBg : colors.surface,
              gap: 2
            }}
          >
            <Text
              className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
              style={{ letterSpacing: -0.1 }}
            >
              {opt.label}
            </Text>
            {opt.helper ? (
              <Text className="font-body text-label text-ink-3 dark:text-ink-3-dark">
                {opt.helper}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
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
  const colors = useThemeColors();
  return (
    <View style={{ gap: 18 }}>
      <PageTitle
        title="What did you cook recently?"
        size="sm"
        subtitle="One real meal makes eeatly useful right away. Skip if you'd rather start with a blank page — you can log later."
      />

      <Card>
        <View style={{ padding: 12, gap: 8 }}>
          <SectionLabel>Meal name</SectionLabel>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Lemon herb chicken bowls"
            placeholderTextColor={colors.ink3}
            editable={!pending}
            maxLength={120}
            autoFocus
            style={{
              minHeight: 44,
              fontFamily: "Geist_500Medium",
              fontSize: 16,
              color: colors.ink,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface
            }}
          />
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Button
          onPress={onLog}
          disabled={pending || value.trim().length < 2}
          loading={pending}
          fullWidth
          size="lg"
        >
          Log it
        </Button>
        <Button
          onPress={onSkip}
          disabled={pending}
          variant="secondary"
          fullWidth
          size="md"
        >
          Skip — I&apos;ll log later
        </Button>
      </View>
    </View>
  );
}

function StepDone({
  onFinish,
  pending
}: {
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <View style={{ gap: 18 }}>
      <PageTitle
        kicker="You're set"
        title="Ready when you are."
        size="md"
        subtitle="Log a meal each time you cook. eeatly starts surfacing dishes worth bringing back after a few logs."
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10
        }}
      >
        <Ionicons name="sparkles-outline" size={20} />
        <Text className="font-body text-body-md text-ink-2 dark:text-ink-2-dark">
          You can invite family to share your kitchen from Settings — no rush.
        </Text>
      </View>
      <Button
        onPress={onFinish}
        loading={pending}
        fullWidth
        size="lg"
        leadingIcon={
          pending ? null : <Ionicons name="arrow-forward" size={18} />
        }
      >
        Open eeatly
      </Button>
    </View>
  );
}

// Marker used by `(authed)/_layout.tsx` to detect the onboarding route
// when it inspects `segments`. Exported so the layout doesn't repeat
// the string literal.
export const ONBOARDING_ROUTE_NAME = "onboarding";
