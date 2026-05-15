import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack } from "expo-router";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View
} from "react-native";
import { ClonePlanSheet } from "../../../components/clone-plan-sheet";
import { formatCookedAt } from "../../../lib/dates";
import { trpc } from "../../../lib/trpc";
import {
  Button,
  Card,
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  Screen
} from "../../../components/ui";

/**
 * Round 17 plans list — NativeWind rebuild.
 *
 * Tile-based scroll, FAB at bottom-right for "+ New plan", clone
 * sheet on long-press (carried over from R14). Each tile shows
 * name + scheduled date + dish count; effort summary lives on the
 * detail page.
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
      <>
        <Stack.Screen
          options={{
            title: "Plans",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <LoadingScreen />
      </>
    );
  }

  if (list.error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Plans",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <ErrorScreen
          title="Couldn't load your plans"
          body="Pull down to retry."
        />
      </>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Plans",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FBF8F1" },
          headerTintColor: "#1A1F1B",
          headerTitleStyle: { fontWeight: "600" }
        }}
      />

      {plans.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={
              <Ionicons name="calendar-outline" size={28} color="#2C5F3F" />
            }
            title="No plans yet"
            body="Plans help you remember what worked for last year's Eid, Diwali, or any occasion. Build a menu, log what each dish took, then clone for next year."
            action={
              <Link href="/(authed)/plans/new" asChild>
                <Pressable>
                  <Button
                    variant="primary"
                    size="lg"
                    leadingIcon={
                      <Ionicons name="add" size={18} color="#FBF8F1" />
                    }
                  >
                    Create your first plan
                  </Button>
                </Pressable>
              </Link>
            }
          />
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          contentContainerClassName="p-4 pb-24 gap-2.5"
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isPending}
              onRefresh={() => list.refetch()}
              tintColor="#2C5F3F"
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
      )}

      <Pressable
        onPress={() => router.push("/(authed)/plans/new")}
        accessibilityRole="button"
        accessibilityLabel="Create a new plan"
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg active:opacity-90"
      >
        <Ionicons name="add" size={28} color="#FBF8F1" />
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
        <Card variant="default">
          <View className="flex-row items-center gap-3 p-4">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#2C5F3F"
              />
            </View>
            <View className="flex-1 gap-1">
              <Text
                className="text-body font-semibold text-foreground"
                numberOfLines={1}
              >
                {name}
              </Text>
              <View className="flex-row items-center gap-1.5 flex-wrap">
                {scheduledDate ? (
                  <>
                    <Text className="text-caption text-foreground-muted">
                      {formatPlanDate(scheduledDate)}
                    </Text>
                    <Text className="text-caption text-foreground-subtle">
                      ·
                    </Text>
                  </>
                ) : null}
                <Text className="text-caption text-foreground-muted">
                  {dishCount === 0
                    ? "No dishes yet"
                    : dishCount === 1
                      ? "1 dish"
                      : `${dishCount} dishes`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9A968A" />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function formatPlanDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  const label = formatCookedAt(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
