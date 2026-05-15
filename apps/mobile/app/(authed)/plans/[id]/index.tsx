import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { PlanAnnotationSheet } from "../../../../components/plan-annotation-sheet";
import { trpc } from "../../../../lib/trpc";
import {
  Button,
  Card,
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionHeader,
  Tag
} from "../../../../components/ui";

/**
 * Round 17 plan detail — NativeWind rebuild.
 *
 * Sections:
 *   - Header card: name, scheduled date, effort summary chip
 *   - "Dishes" section header
 *   - Dish list: each row shows name + annotation badges (verdict,
 *     effort, time) + previous-occasion hint badges. Tap to annotate;
 *     long-press to remove.
 *   - "Add dish to plan" Button → bottom sheet with meal library search.
 *
 * Hint badges (Task 3, R14): if the plan was cloned, dish rows
 * render "Last time: …" badges driven by `previousAnnotationsByMeal`.
 */

type EffortValue = "quick" | "easy" | "medium" | "high_effort";
type VerdictValue = "repeat" | "modify" | "do_not_repeat";

const EFFORT_LABEL: Record<EffortValue, string> = {
  quick: "Quick",
  easy: "Easy",
  medium: "Medium",
  high_effort: "High effort"
};

const VERDICT_DISPLAY: Record<
  VerdictValue,
  { label: string; tagVariant: "primary" | "accent" | "destructive" }
> = {
  repeat: { label: "Repeat", tagVariant: "primary" },
  modify: { label: "Modify", tagVariant: "accent" },
  do_not_repeat: { label: "Don't repeat", tagVariant: "destructive" }
};

function formatPlanDate(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";

  const planQuery = trpc.plans.getById.useQuery(
    { planId },
    { enabled: planId.length > 0, staleTime: 30_000 }
  );
  const effortQuery = trpc.plans.effortAggregate.useQuery(
    { planId },
    { enabled: planId.length > 0, staleTime: 30_000 }
  );
  const hintsQuery = trpc.plans.previousAnnotationsByMeal.useQuery(
    { planId },
    { enabled: planId.length > 0, staleTime: 60_000 }
  );

  const [addDishOpen, setAddDishOpen] = useState(false);
  const [annotationDish, setAnnotationDish] = useState<{
    planDishId: string;
    name: string;
    initial: {
      actualEffort: EffortValue | null;
      timeTakenMinutes: number | null;
      verdict: VerdictValue | null;
      annotationNotes: string | null;
    };
  } | null>(null);

  const utils = trpc.useUtils();

  const removeMutation = trpc.plans.removeDish.useMutation({
    onSuccess: () => {
      utils.plans.getById.invalidate({ planId });
      utils.plans.effortAggregate.invalidate({ planId });
    },
    onError: (e) =>
      Alert.alert("Couldn't remove dish", e.message || "Try again.")
  });

  const plan = planQuery.data;
  const dishes = plan?.dishes ?? [];

  const hintsByMealId = useMemo(
    () => hintsQuery.data ?? {},
    [hintsQuery.data]
  );

  function confirmRemove(planDishId: string, dishName: string) {
    Alert.alert(
      "Remove dish?",
      `Take "${dishName}" off this plan? You can add it back later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeMutation.mutate({
              planId,
              dish: { planDishId }
            })
        }
      ]
    );
  }

  const headerRight = plan
    ? () => (
        <Link href={`/(authed)/plans/${planId}/edit` as never} asChild>
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Edit plan"
            style={{ paddingHorizontal: 16 }}
          >
            <Ionicons name="create-outline" size={22} color="#2C5F3F" />
          </Pressable>
        </Link>
      )
    : undefined;

  if (planQuery.isPending) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Plan",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <LoadingScreen />
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Plan",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <Screen edges={["bottom"]}>
          <ErrorScreen
            title="Plan not found"
            body="It may have been archived, or you don't have access in this kitchen."
          />
          <View className="px-8 -mt-2 items-center">
            <Button
              variant="secondary"
              onPress={() => router.replace("/(authed)/plans")}
            >
              Back to plans
            </Button>
          </View>
        </Screen>
      </>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: plan.name,
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FBF8F1" },
          headerTintColor: "#1A1F1B",
          headerTitleStyle: { fontWeight: "600" },
          headerRight
        }}
      />

      <ScrollView
        contentContainerClassName="pb-12 gap-2"
        refreshControl={
          <RefreshControl
            refreshing={planQuery.isFetching && !planQuery.isPending}
            onRefresh={() => {
              planQuery.refetch();
              effortQuery.refetch();
            }}
            tintColor="#2C5F3F"
          />
        }
      >
        <View className="px-4 pt-4 gap-2">
          <Text className="text-heading-1 font-bold text-foreground">
            {plan.name}
          </Text>
          {plan.scheduledDate ? (
            <Text className="text-caption text-foreground-muted">
              {formatPlanDate(plan.scheduledDate)}
            </Text>
          ) : null}
          <EffortChip data={effortQuery.data} />
        </View>

        <SectionHeader title="Dishes" />

        {dishes.length === 0 ? (
          <View className="flex-1">
            <EmptyState
              icon={
                <Ionicons name="list-outline" size={28} color="#2C5F3F" />
              }
              title="No dishes added yet"
              body="Tap the button below to pick from your kitchen."
            />
          </View>
        ) : (
          <View className="px-4 gap-2">
            {dishes.map((d) => (
              <DishRow
                key={d.id}
                mealId={d.mealId}
                mealName={d.mealName}
                effort={d.actualEffort as EffortValue | null}
                timeTakenMinutes={d.timeTakenMinutes}
                verdict={d.verdict as VerdictValue | null}
                hint={hintsByMealId[d.mealId] ?? null}
                onEdit={() =>
                  setAnnotationDish({
                    planDishId: d.id,
                    name: d.mealName,
                    initial: {
                      actualEffort: d.actualEffort as EffortValue | null,
                      timeTakenMinutes: d.timeTakenMinutes,
                      verdict: d.verdict as VerdictValue | null,
                      annotationNotes: d.annotationNotes
                    }
                  })
                }
                onLongPress={() => confirmRemove(d.id, d.mealName)}
              />
            ))}
          </View>
        )}

        <View className="px-4 mt-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leadingIcon={
              <Ionicons name="add-circle-outline" size={18} color="#FBF8F1" />
            }
            onPress={() => setAddDishOpen(true)}
          >
            Add dish to plan
          </Button>
        </View>
      </ScrollView>

      <AddDishSheet
        visible={addDishOpen}
        onClose={() => setAddDishOpen(false)}
        planId={planId}
      />

      {annotationDish ? (
        <PlanAnnotationSheet
          visible
          onClose={() => setAnnotationDish(null)}
          planId={planId}
          planDishId={annotationDish.planDishId}
          dishName={annotationDish.name}
          initial={annotationDish.initial}
        />
      ) : null}
    </Screen>
  );
}

function EffortChip({
  data
}: {
  data:
    | {
        quick: number;
        easy: number;
        medium: number;
        high_effort: number;
        unrated: number;
      }
    | undefined;
}) {
  if (!data) return null;
  const total =
    data.quick + data.easy + data.medium + data.high_effort + data.unrated;
  if (total === 0) return null;
  const parts: string[] = [];
  if (data.quick) parts.push(`${data.quick} quick`);
  if (data.easy) parts.push(`${data.easy} easy`);
  if (data.medium) parts.push(`${data.medium} medium`);
  if (data.high_effort) parts.push(`${data.high_effort} high`);
  if (data.unrated) parts.push(`${data.unrated} unrated`);
  return (
    <View className="self-start flex-row items-center gap-1.5 rounded-pill bg-primary-muted px-2.5 py-1.5">
      <Ionicons name="speedometer-outline" size={14} color="#2C5F3F" />
      <Text className="text-caption-strong font-semibold text-primary">
        {parts.join(" · ")}
      </Text>
    </View>
  );
}

function DishRow({
  mealId,
  mealName,
  effort,
  timeTakenMinutes,
  verdict,
  hint,
  onEdit,
  onLongPress
}: {
  mealId: string;
  mealName: string;
  effort: EffortValue | null;
  timeTakenMinutes: number | null;
  verdict: VerdictValue | null;
  hint: {
    actualEffort: EffortValue | null;
    timeTakenMinutes: number | null;
    verdict: VerdictValue | null;
    annotationNotes: string | null;
  } | null;
  onEdit: () => void;
  onLongPress: () => void;
}) {
  const verdictDisplay = verdict ? VERDICT_DISPLAY[verdict] : null;
  const effortLabel = effort ? EFFORT_LABEL[effort] : null;
  const hintLabels: string[] = [];
  if (hint?.verdict) {
    hintLabels.push(`Last time: ${VERDICT_DISPLAY[hint.verdict].label.toLowerCase()}`);
  }
  if (hint?.timeTakenMinutes != null) {
    hintLabels.push(`Last time: ${hint.timeTakenMinutes} min`);
  } else if (hint?.actualEffort) {
    hintLabels.push(
      `Last time: ${EFFORT_LABEL[hint.actualEffort].toLowerCase()}`
    );
  }

  return (
    <Pressable
      onPress={onEdit}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${mealName}. Tap to annotate, long-press to remove.`}
      className="active:opacity-90"
    >
      <Card variant="default">
        <View className="flex-row items-start gap-3 p-3.5">
          <View className="flex-1 gap-1.5">
            <Link href={`/(authed)/meal/${mealId}` as never} asChild>
              <Pressable hitSlop={4} className="active:opacity-70">
                <Text
                  className="text-body font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {mealName}
                </Text>
              </Pressable>
            </Link>
            {verdictDisplay || effortLabel || timeTakenMinutes != null ? (
              <View className="flex-row flex-wrap gap-1.5">
                {verdictDisplay ? (
                  <Tag variant={verdictDisplay.tagVariant}>
                    {verdictDisplay.label}
                  </Tag>
                ) : null}
                {effortLabel ? <Tag variant="default">{effortLabel}</Tag> : null}
                {timeTakenMinutes != null ? (
                  <Tag variant="default">{`${timeTakenMinutes} min`}</Tag>
                ) : null}
              </View>
            ) : null}
            {hintLabels.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5 mt-0.5">
                {hintLabels.map((label) => (
                  <Tag key={label} variant="muted">
                    {label}
                  </Tag>
                ))}
              </View>
            ) : null}
          </View>
          <Ionicons name="create-outline" size={18} color="#9A968A" />
        </View>
      </Card>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- */
/* Add dish bottom sheet — search the meal library and pick one.    */
/* ----------------------------------------------------------------- */

function AddDishSheet({
  visible,
  onClose,
  planId
}: {
  visible: boolean;
  onClose: () => void;
  planId: string;
}) {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const library = trpc.plans.mealLibrary.useQuery(
    { q: query.trim() || undefined, limit: 30 },
    { enabled: visible, staleTime: 30_000 }
  );

  const addMutation = trpc.plans.addDish.useMutation({
    onSuccess: () => {
      utils.plans.getById.invalidate({ planId });
      utils.plans.effortAggregate.invalidate({ planId });
      setAdding(null);
      onClose();
    },
    onError: (e) => {
      setAdding(null);
      Alert.alert("Couldn't add dish", e.message || "Try again.");
    }
  });

  function add(mealId: string) {
    setAdding(mealId);
    addMutation.mutate({ planId, dish: { mealId } });
  }

  const rows = library.data ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-foreground/40 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => null}
          className="bg-background-elevated rounded-t-lg pb-7 max-h-[85%]"
        >
          <View className="items-center py-2.5">
            <View className="w-9 h-1 rounded-full bg-border-strong" />
          </View>
          <View className="px-5 pb-2 gap-3">
            <Text className="text-heading-3 font-semibold text-foreground">
              Add a dish
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your meals…"
              placeholderTextColor="#9A968A"
              className="h-12 rounded-md border border-border bg-background px-3 text-body text-foreground"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {library.isPending ? (
              <ActivityIndicator color="#2C5F3F" style={{ marginTop: 12 }} />
            ) : rows.length === 0 ? (
              <Text className="text-caption italic text-foreground-muted py-3">
                {query.trim()
                  ? "No matches. Try a different search."
                  : "Your meal library is empty. Add a meal log first."}
              </Text>
            ) : (
              <ScrollView className="max-h-[360px]">
                {rows.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => add(m.id)}
                    disabled={adding != null}
                    accessibilityRole="button"
                    className={`flex-row items-center justify-between py-3 px-2.5 border-b border-border active:bg-background-muted ${
                      adding != null ? "opacity-50" : ""
                    }`}
                  >
                    <Text
                      className="flex-1 text-body text-foreground"
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    {adding === m.id ? (
                      <ActivityIndicator size="small" color="#2C5F3F" />
                    ) : (
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="#2C5F3F"
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
