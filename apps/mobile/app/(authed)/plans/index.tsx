import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClonePlanSheet } from "../../../components/clone-plan-sheet";
import { formatCookedAt } from "../../../lib/dates";
import { trpc } from "../../../lib/trpc";

/**
 * Round 14 Task 2 — Plans list. Tile-based, tap a tile to push to
 * detail. FAB at bottom-right for "+ New plan". Empty state explains
 * the use case (Eid, Diwali, occasion menus) and primary-CTA's into
 * the create flow.
 *
 * Each tile shows name + scheduled date + dish count. Effort summary
 * lives on the detail page (computing it for every list row would be
 * N+1 — `plans.effortAggregate` is per-plan).
 */
export default function PlansListScreen() {
  const list = trpc.plans.list.useQuery(undefined, { staleTime: 30_000 });
  const [cloneSource, setCloneSource] = useState<{ id: string; name: string } | null>(
    null
  );

  const plans = list.data ?? [];

  function offerClone(id: string, name: string) {
    Alert.alert(
      name,
      "Clone this plan for a new occasion? Dishes carry over; last year's verdicts appear as hints.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clone for this year",
          onPress: () => setCloneSource({ id, name })
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Plans", headerBackTitle: "Back" }} />

      {list.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2f6f58" />
        </View>
      ) : plans.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isPending}
              onRefresh={() => list.refetch()}
              tintColor="#2f6f58"
            />
          }
        >
          <EmptyState />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isPending}
              onRefresh={() => list.refetch()}
              tintColor="#2f6f58"
            />
          }
        >
          {plans.map((p) => (
            <PlanTile
              key={p.id}
              id={p.id}
              name={p.name}
              scheduledDate={p.scheduledDate}
              dishCount={p.dishCount}
              onLongPress={() => offerClone(p.id, p.name)}
            />
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push("/(authed)/plans/new")}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Create a new plan"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {cloneSource ? (
        <ClonePlanSheet
          visible
          onClose={() => setCloneSource(null)}
          sourcePlanId={cloneSource.id}
          sourceName={cloneSource.name}
        />
      ) : null}
    </SafeAreaView>
  );
}

function PlanTile({
  id,
  name,
  scheduledDate,
  dishCount,
  onLongPress
}: {
  id: string;
  name: string;
  scheduledDate: string | null;
  dishCount: number;
  onLongPress?: () => void;
}) {
  return (
    <Link href={`/(authed)/plans/${id}` as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${dishCount} dishes. Long-press to clone.`}
        onLongPress={onLongPress}
        delayLongPress={420}
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      >
        <View style={styles.tileBody}>
          <Text style={styles.tileName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.tileMeta}>
            {scheduledDate ? (
              <Text style={styles.tileMetaText}>
                {formatPlanDate(scheduledDate)}
              </Text>
            ) : null}
            {scheduledDate ? <Text style={styles.metaDot}>·</Text> : null}
            <Text style={styles.tileMetaText}>
              {dishCount === 0
                ? "No dishes yet"
                : dishCount === 1
                  ? "1 dish"
                  : `${dishCount} dishes`}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#aaa" />
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="calendar-outline" size={36} color="#9c9b8e" />
      <Text style={styles.emptyTitle}>No plans yet</Text>
      <Text style={styles.emptyBody}>
        Plans help you remember what worked for last year's Eid, Diwali, or
        any occasion. Build a menu, log what each dish took, then clone for
        next year.
      </Text>
      <Link href="/(authed)/plans/new" asChild>
        <Pressable
          style={({ pressed }) => [
            styles.emptyButton,
            pressed && styles.pressed
          ]}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.emptyButtonText}>Create your first plan</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function formatPlanDate(ymd: string): string {
  // Same parsing approach as the meal log form: build a local Date so we
  // don't roll over when ymd is interpreted as UTC.
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  // Reuse formatCookedAt for "today/yesterday/N days ago" up to a week,
  // then a localized month-day. The label says "cooked" semantically for
  // meals — for plan dates we use the same shape but it reads naturally.
  const label = formatCookedAt(date);
  // Capitalize first letter for tile copy ("Today" / "Yesterday").
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  scroll: {
    padding: 16,
    gap: 10,
    paddingBottom: 96
  },
  emptyScroll: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 96
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 80,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  tilePressed: { backgroundColor: "#f3f1ea" },
  tileBody: { flex: 1, gap: 4 },
  tileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111"
  },
  tileMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  tileMetaText: { fontSize: 13, color: "#666" },
  metaDot: { fontSize: 13, color: "#aaa" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 12
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111"
  },
  emptyBody: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2f6f58",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
    marginTop: 6
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  fabPressed: { opacity: 0.85 },
  pressed: { opacity: 0.85 }
});
