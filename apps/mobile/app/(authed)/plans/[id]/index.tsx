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
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlanAnnotationSheet } from "../../../../components/plan-annotation-sheet";
import { trpc } from "../../../../lib/trpc";

/**
 * Round 14 Task 2 + 3 — plan detail.
 *
 * Sections, top to bottom:
 *   - Header: plan name, scheduled date, edit pencil to push to /edit.
 *   - Effort summary chip from `plans.effortAggregate`.
 *   - Dish list: each row shows name + annotation badges + tap-to-edit.
 *     Long-press for remove confirmation. Tap (not the badges) routes
 *     to the recipe view.
 *   - "Add dish to plan" button → bottom sheet with meal-library search.
 *
 * Hints (Task 3): if the plan was cloned from a past plan, dish rows
 * render "Last time: …" hint badges driven by the
 * `plans.previousAnnotationsByMeal` query. The hint surface is purely
 * informational — the user's own annotations live next to them.
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
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  repeat: { label: "Repeat", color: "#2f6f58", icon: "checkmark-circle" },
  modify: { label: "Modify", color: "#a3691b", icon: "alert-circle" },
  do_not_repeat: { label: "Don't repeat", color: "#b91c1c", icon: "close-circle" }
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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: plan?.name ?? "Plan",
          headerBackTitle: "Back",
          headerRight: () =>
            plan ? (
              <Link href={`/(authed)/plans/${planId}/edit` as never} asChild>
                <Pressable
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Edit plan"
                  style={{ paddingHorizontal: 16 }}
                >
                  <Ionicons name="create-outline" size={22} color="#2f6f58" />
                </Pressable>
              </Link>
            ) : null
        }}
      />

      {planQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2f6f58" />
        </View>
      ) : !plan ? (
        <MissingState />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={planQuery.isFetching && !planQuery.isPending}
              onRefresh={() => {
                planQuery.refetch();
                effortQuery.refetch();
              }}
              tintColor="#2f6f58"
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>{plan.name}</Text>
            {plan.scheduledDate ? (
              <Text style={styles.dateLine}>
                {formatPlanDate(plan.scheduledDate)}
              </Text>
            ) : null}
            <EffortChip data={effortQuery.data} />
          </View>

          <Text style={styles.sectionHeading}>Dishes</Text>

          {dishes.length === 0 ? (
            <Text style={styles.emptyText}>
              No dishes on this plan yet. Tap "Add dish" to pick from your
              kitchen.
            </Text>
          ) : (
            <View style={styles.dishList}>
              {dishes.map((d) => (
                <DishRow
                  key={d.id}
                  planDishId={d.id}
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

          <Pressable
            onPress={() => setAddDishOpen(true)}
            style={({ pressed }) => [
              styles.addDishButton,
              pressed && styles.pressed
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addDishText}>Add dish to plan</Text>
          </Pressable>
        </ScrollView>
      )}

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
    </SafeAreaView>
  );
}

function MissingState() {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={32} color="#888" />
      <Text style={styles.missingTitle}>Plan not found</Text>
      <Text style={styles.missingBody}>
        It may have been archived, or you don't have access in this kitchen.
      </Text>
      <Pressable
        onPress={() => router.replace("/(authed)/plans")}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>Back to plans</Text>
      </Pressable>
    </View>
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
    <View style={styles.effortChip}>
      <Ionicons name="speedometer-outline" size={14} color="#2f6f58" />
      <Text style={styles.effortChipText}>{parts.join(" · ")}</Text>
    </View>
  );
}

function DishRow({
  planDishId,
  mealId,
  mealName,
  effort,
  timeTakenMinutes,
  verdict,
  hint,
  onEdit,
  onLongPress
}: {
  planDishId: string;
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
  const hintBadges: Array<{ label: string; color: string }> = [];
  if (hint?.verdict) {
    const v = VERDICT_DISPLAY[hint.verdict];
    hintBadges.push({ label: `Last time: ${v.label.toLowerCase()}`, color: v.color });
  }
  if (hint?.timeTakenMinutes != null) {
    hintBadges.push({
      label: `Last time: ${hint.timeTakenMinutes} min`,
      color: "#666"
    });
  } else if (hint?.actualEffort) {
    hintBadges.push({
      label: `Last time: ${EFFORT_LABEL[hint.actualEffort].toLowerCase()}`,
      color: "#666"
    });
  }

  return (
    <Pressable
      onPress={onEdit}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.dishRow, pressed && styles.dishRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${mealName}. Tap to annotate, long-press to remove.`}
    >
      <View style={styles.dishRowMain}>
        <Link href={`/(authed)/meal/${mealId}` as never} asChild>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.dishName} numberOfLines={1}>
              {mealName}
            </Text>
          </Pressable>
        </Link>
        {(verdictDisplay || effortLabel || timeTakenMinutes != null) ? (
          <View style={styles.badgeRow}>
            {verdictDisplay ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: verdictDisplay.color }
                ]}
              >
                <Ionicons
                  name={verdictDisplay.icon}
                  size={12}
                  color="#fff"
                />
                <Text style={styles.badgeText}>{verdictDisplay.label}</Text>
              </View>
            ) : null}
            {effortLabel ? (
              <View style={[styles.badge, styles.badgeNeutral]}>
                <Text style={styles.badgeNeutralText}>{effortLabel}</Text>
              </View>
            ) : null}
            {timeTakenMinutes != null ? (
              <View style={[styles.badge, styles.badgeNeutral]}>
                <Text style={styles.badgeNeutralText}>
                  {timeTakenMinutes} min
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {hintBadges.length > 0 ? (
          <View style={styles.hintRow}>
            {hintBadges.map((h, i) => (
              <View
                key={`${h.label}-${i}`}
                style={[styles.hintBadge, { borderColor: h.color }]}
              >
                <Ionicons name="time-outline" size={11} color={h.color} />
                <Text style={[styles.hintText, { color: h.color }]}>
                  {h.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Ionicons name="create-outline" size={18} color="#888" />
      {/* Silence unused-prop warning — planDishId is used by parent via callback. */}
      <View style={styles.hiddenMeta}>
        <Text>{planDishId}</Text>
      </View>
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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => null}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>Add a dish</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your meals…"
              placeholderTextColor="#999"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {library.isPending ? (
              <ActivityIndicator color="#2f6f58" style={{ marginTop: 12 }} />
            ) : rows.length === 0 ? (
              <Text style={styles.emptyText}>
                {query.trim()
                  ? "No matches. Try a different search."
                  : "Your meal library is empty. Add a meal log first."}
              </Text>
            ) : (
              <ScrollView style={styles.libraryList}>
                {rows.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => add(m.id)}
                    disabled={adding != null}
                    style={({ pressed }) => [
                      styles.libraryRow,
                      pressed && styles.libraryRowPressed,
                      adding != null && styles.disabled
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.libraryName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {adding === m.id ? (
                      <ActivityIndicator size="small" color="#2f6f58" />
                    ) : (
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="#2f6f58"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 14
  },
  header: { gap: 6 },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111",
    lineHeight: 30
  },
  dateLine: { fontSize: 13, color: "#666" },
  effortChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#eef5f1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cfe1d7",
    marginTop: 4
  },
  effortChipText: {
    fontSize: 11.5,
    color: "#1f4a3b",
    fontWeight: "500"
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4
  },
  emptyText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    paddingVertical: 12
  },
  dishList: { gap: 8 },
  dishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    minHeight: 80
  },
  dishRowPressed: { backgroundColor: "#f3f1ea" },
  dishRowMain: { flex: 1, gap: 6 },
  dishName: { fontSize: 15, fontWeight: "500", color: "#111" },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500"
  },
  badgeNeutral: {
    backgroundColor: "#eef2ef",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d6dbd6"
  },
  badgeNeutralText: { color: "#444", fontSize: 11, fontWeight: "500" },
  hintRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2
  },
  hintBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#fff"
  },
  hintText: { fontSize: 11, fontWeight: "500" },
  hiddenMeta: {
    width: 0,
    height: 0,
    overflow: "hidden",
    opacity: 0
  },
  addDishButton: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#2f6f58"
  },
  addDishText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    maxHeight: "85%"
  },
  handleWrap: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#dcd9d2" },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12
  },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#111" },
  searchInput: {
    minHeight: 46,
    borderColor: "#d4d2cb",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff"
  },
  libraryList: { maxHeight: 360 },
  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  libraryRowPressed: { backgroundColor: "#f3f1ea" },
  libraryName: { flex: 1, fontSize: 15, color: "#111" },
  missingTitle: { fontSize: 18, fontWeight: "600", color: "#111", marginTop: 4 },
  missingBody: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 12
  },
  linkButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  linkText: { color: "#2f6f58", fontSize: 14, fontWeight: "500" }
});
