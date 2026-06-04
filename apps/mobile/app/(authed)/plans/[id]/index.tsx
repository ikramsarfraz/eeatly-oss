import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, useLocalSearchParams } from "expo-router";
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
import { TopNav } from "../../../../components/top-nav";
import { useThemeColors } from "../../../../lib/design/use-theme-colors";
import { trpc } from "../../../../lib/trpc";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  PageTitle,
  Screen,
  SectionLabel,
  Tag
} from "../../../../components/ui";

/**
 * Round 18 plan detail — editorial rebuild.
 *
 * Stack:
 *   - TopNav: title "Eid Al Adha", back chevron left, pencil-edit right.
 *   - Hero: serif title 46pt + mono date eyebrow + sage chip with
 *     gauge icon ("2 dishes · medium").
 *   - "Dishes" section label → list of cards (44pt monogram + name +
 *     pencil icon trailing).
 *   - Full-width forest CTA with leading plus-circle: "Add dish to plan".
 *
 * Annotation + remove flows carry over unchanged from R17.
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

function formatPlanEyebrow(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleString("en-US", { weekday: "short" });
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${weekday} · ${month} ${date.getDate()} · ${date.getFullYear()}`.toUpperCase();
}

export default function PlanDetailScreen() {
  const colors = useThemeColors();
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

  // R24 — archive / unarchive. Both invalidate `plans.list` so the
  // plans index repaints with the plan in / out of the default
  // filter view; archive sends the user back to the list afterward so
  // they see the immediate effect. Unarchive stays on the detail
  // screen because the user likely wants to keep working with it.
  const archiveMutation = trpc.plans.archive.useMutation({
    onSuccess: () => {
      utils.plans.list.invalidate();
      utils.plans.getById.invalidate({ planId });
      router.replace("/(authed)/plans");
    },
    onError: (e) =>
      Alert.alert("Couldn't archive", e.message || "Try again.")
  });

  const unarchiveMutation = trpc.plans.unarchive.useMutation({
    onSuccess: () => {
      utils.plans.list.invalidate();
      utils.plans.getById.invalidate({ planId });
    },
    onError: (e) =>
      Alert.alert("Couldn't unarchive", e.message || "Try again.")
  });

  function confirmArchive() {
    Alert.alert(
      "Archive plan?",
      "It'll move out of your default plans list. You can bring it back later via the archived filter.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => archiveMutation.mutate({ planId })
        }
      ]
    );
  }

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

  if (planQuery.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Plan" back />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Plan" back />
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
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title={plan.name}
        back
        right={
          <Link href={`/(authed)/plans/${planId}/edit` as never} asChild>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit plan"
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={colors.forest}
              />
            </Pressable>
          </Link>
        }
        showSettings={false}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={planQuery.isFetching && !planQuery.isPending}
            onRefresh={() => {
              planQuery.refetch();
              effortQuery.refetch();
            }}
            tintColor={colors.forest}
          />
        }
      >
        <View style={{ paddingTop: 12, marginBottom: 22 }}>
          <PageTitle
            title={plan.name}
            size="lg"
            eyebrow={formatPlanEyebrow(plan.scheduledDate) ?? undefined}
          />
          <View style={{ marginTop: 14 }}>
            <EffortChip data={effortQuery.data} />
          </View>
        </View>

        <SectionLabel>Dishes</SectionLabel>

        {dishes.length === 0 ? (
          <View style={{ paddingVertical: 8 }}>
            <EmptyState
              icon={
                <Ionicons name="list-outline" size={28} color={colors.forest} />
              }
              title="No dishes added yet"
              body="Tap the button below to pick from your kitchen."
            />
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 18 }}>
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

        <View style={{ marginTop: 8 }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leadingIcon={
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.forestText}
              />
            }
            onPress={() => setAddDishOpen(true)}
          >
            Add dish to plan
          </Button>
        </View>

        {/* R24 — archive / unarchive lives at the bottom so it doesn't
            compete with the primary "Add dish" CTA. Archived plans get
            an "Archived" eyebrow above the action so the state is
            visible without scrolling back up. */}
        <View style={{ marginTop: 32, gap: 8 }}>
          {plan.archivedAt ? (
            <>
              <Chip tone="ghost">Archived</Chip>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                loading={unarchiveMutation.isPending}
                onPress={() => unarchiveMutation.mutate({ planId })}
              >
                Unarchive plan
              </Button>
            </>
          ) : (
            <Button
              variant="outline-destructive"
              size="md"
              fullWidth
              loading={archiveMutation.isPending}
              onPress={confirmArchive}
            >
              Archive plan
            </Button>
          )}
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
  const colors = useThemeColors();
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
    <Chip
      tone="sage"
      icon={
        <Ionicons name="speedometer-outline" size={14} color={colors.forest} />
      }
    >
      {parts.join(" · ")}
    </Chip>
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
  const colors = useThemeColors();
  const verdictDisplay = verdict ? VERDICT_DISPLAY[verdict] : null;
  const effortLabel = effort ? EFFORT_LABEL[effort] : null;
  const hintLabels: string[] = [];
  if (hint?.verdict) {
    hintLabels.push(
      `Last time: ${VERDICT_DISPLAY[hint.verdict].label.toLowerCase()}`
    );
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
      <Card>
        <View
          className="flex-row items-start p-3"
          style={{ gap: 12 }}
        >
          <View style={{ width: 44, height: 44 }}>
            <MealTile name={mealName} size="sm" radius={8} />
          </View>
          <View className="flex-1 gap-1.5">
            <Link href={`/(authed)/meal/${mealId}` as never} asChild>
              <Pressable hitSlop={4} className="active:opacity-70">
                <Text
                  className="font-body-semibold text-body-lg text-ink dark:text-ink-dark"
                  style={{ letterSpacing: -0.1 }}
                  numberOfLines={1}
                >
                  {mealName}
                </Text>
              </Pressable>
            </Link>
            {verdictDisplay || effortLabel || timeTakenMinutes != null ? (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
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
              <View
                className="flex-row flex-wrap"
                style={{ gap: 6, marginTop: 2 }}
              >
                {hintLabels.map((label) => (
                  <Tag key={label} variant="muted">
                    {label}
                  </Tag>
                ))}
              </View>
            ) : null}
          </View>
          <Ionicons name="create-outline" size={18} color={colors.ink3} />
        </View>
      </Card>
    </Pressable>
  );
}

/* ─── Add dish bottom sheet ─────────────────────────────────────── */

function AddDishSheet({
  visible,
  onClose,
  planId
}: {
  visible: boolean;
  onClose: () => void;
  planId: string;
}) {
  const colors = useThemeColors();
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
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(20,20,15,0.32)",
          justifyContent: "flex-end"
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => null}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingBottom: 32,
            maxHeight: "85%"
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 12 }}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.ink4
              }}
            />
          </View>
          <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
            <Text
              className="font-display text-display-xs text-ink dark:text-ink-dark"
              style={{ letterSpacing: -0.4, marginBottom: 14 }}
            >
              Add a dish
            </Text>

            <View
              className="flex-row items-center"
              style={{
                backgroundColor: colors.cream,
                borderWidth: 1,
                borderColor: colors.sageDeep,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 10,
                marginBottom: 14
              }}
            >
              <Ionicons name="search" size={18} color={colors.ink3} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your meals…"
                placeholderTextColor={colors.ink3}
                style={{
                  flex: 1,
                  fontFamily: "Geist_400Regular",
                  fontSize: 15,
                  color: colors.ink,
                  paddingVertical: 0
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {library.isPending ? (
              <ActivityIndicator
                color={colors.forest}
                style={{ marginTop: 12 }}
              />
            ) : rows.length === 0 ? (
              <Text className="font-body italic text-body-md text-ink-2 dark:text-ink-2-dark py-3">
                {query.trim()
                  ? "No matches. Try a different search."
                  : "Your meal library is empty. Add a meal log first."}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {rows.map((m, i) => (
                  <Pressable
                    key={m.id}
                    onPress={() => add(m.id)}
                    disabled={adding != null}
                    accessibilityRole="button"
                    className="active:opacity-70"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      gap: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSoft,
                      opacity: adding != null ? 0.5 : 1
                    }}
                  >
                    <View style={{ width: 36, height: 36 }}>
                      <MealTile name={m.name} size="sm" radius={8} />
                    </View>
                    <Text
                      className="flex-1 font-body-semibold text-body-md text-ink dark:text-ink-dark"
                      style={{ letterSpacing: -0.1 }}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    {adding === m.id ? (
                      <ActivityIndicator size="small" color={colors.forest} />
                    ) : (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 99,
                          borderWidth: 1.5,
                          borderColor: colors.forest,
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <Ionicons name="add" size={18} color={colors.forest} />
                      </View>
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
