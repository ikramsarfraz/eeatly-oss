import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View
} from "react-native";
import { ClonePlanSheet } from "../../../components/clone-plan-sheet";
import { TopNav } from "../../../components/top-nav";
import { formatCookedAt } from "../../../lib/dates";
import { colors } from "../../../lib/design/tokens";
import { trpc } from "../../../lib/trpc";
import {
  Card,
  ErrorScreen,
  IconBubble,
  LoadingScreen,
  PageTitle,
  Screen
} from "../../../components/ui";

/**
 * Round 18 plans list — editorial rebuild.
 *
 * Layout: TopNav with back chevron (gear right) → big serif "Plans"
 * title + subtitle → vertical list of plan cards (44pt sage IconBubble
 * + name + mono date eyebrow + chevron) → italic serif empty hint
 * when the list is short → floating forest FAB at bottom-right for
 * "+ new plan".
 */
export default function PlansListScreen() {
  const list = trpc.plans.list.useQuery(undefined, { staleTime: 30_000 });
  const [cloneSource, setCloneSource] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  if (list.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Plans" back />
        <LoadingScreen />
      </Screen>
    );
  }

  if (list.error) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Plans" back />
        <ErrorScreen
          title="Couldn't load your plans"
          body="Pull down to retry."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav title="Plans" back />

      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 22 }}>
            <PageTitle
              title="Plans"
              size="md"
              subtitle="Occasion menus, dinners, weeknight cooks."
            />
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: 140
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <Text
              className="font-display-italic text-display-xs text-ink-2"
              style={{ letterSpacing: -0.3, marginBottom: 8 }}
            >
              No plans yet.
            </Text>
            <Text
              className="font-body text-body-md text-ink-3 text-center"
              style={{ maxWidth: 260, lineHeight: 21 }}
            >
              Use plans for menus tied to a date — Eid, Diwali, a dinner party.
            </Text>
          </View>
        }
        ListFooterComponent={
          plans.length > 0 ? (
            <View style={{ alignItems: "center", marginTop: 36 }}>
              <Text
                className="font-display-italic text-display-xs text-ink-2"
                style={{ letterSpacing: -0.3, marginBottom: 8 }}
              >
                {plans.length === 1 ? "One plan so far." : "That's all for now."}
              </Text>
              <Text
                className="font-body text-body-md text-ink-3 text-center"
                style={{ maxWidth: 260, lineHeight: 21 }}
              >
                Use plans for menus tied to a date — Eid, Diwali, a dinner party.
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching && !list.isPending}
            onRefresh={() => list.refetch()}
            tintColor={colors.forest}
          />
        }
        renderItem={({ item }) => (
          <PlanTile
            id={item.id}
            name={item.name}
            scheduledDate={item.scheduledDate}
            dishCount={item.dishCount}
            onLongPress={() => offerClone(item.id, item.name)}
          />
        )}
      />

      <Pressable
        onPress={() => router.push("/(authed)/plans/new")}
        accessibilityRole="button"
        accessibilityLabel="Create a new plan"
        style={{
          position: "absolute",
          bottom: 28,
          right: 22,
          width: 56,
          height: 56,
          borderRadius: 99,
          backgroundColor: colors.forest,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.forest,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 20,
          elevation: 6
        }}
        className="active:opacity-90"
      >
        <Ionicons name="add" size={26} color={colors.forestText} />
      </Pressable>

      {cloneSource ? (
        <ClonePlanSheet
          visible
          onClose={() => setCloneSource(null)}
          sourcePlanId={cloneSource.id}
          sourceName={cloneSource.name}
        />
      ) : null}
    </Screen>
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
        className="active:opacity-90"
      >
        <Card>
          <View
            className="flex-row items-center p-3.5"
            style={{ gap: 12 }}
          >
            <IconBubble size={48}>
              <Ionicons
                name="calendar-outline"
                size={22}
                color={colors.forest}
              />
            </IconBubble>
            <View className="flex-1 gap-1">
              <Text
                className="font-body-semibold text-title-md text-ink"
                style={{ letterSpacing: -0.1 }}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                className="font-mono text-eyebrow text-ink-3 uppercase"
                style={{ letterSpacing: 0.6 }}
                numberOfLines={1}
              >
                {planEyebrow(scheduledDate, dishCount)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function planEyebrow(scheduledDate: string | null, dishCount: number): string {
  const dishes =
    dishCount === 0
      ? "no dishes"
      : dishCount === 1
        ? "1 dish"
        : `${dishCount} dishes`;
  if (!scheduledDate) return dishes;
  const [y, m, d] = scheduledDate.split("-").map(Number);
  if (!y || !m || !d) return dishes;
  return `${formatCookedAt(new Date(y, m - 1, d))} · ${dishes}`;
}
