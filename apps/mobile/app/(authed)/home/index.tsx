import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
// R24 — home TopNav `right` slot now stacks the notification bell next
// to the settings gear; both need to be reachable from the home tab.
import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { authClient } from "../../../lib/auth/client";
import { clearSessionToken } from "../../../lib/auth/session";
import { dateEyebrow, displayFirstName, greetingFor } from "../../../lib/design/greeting";
import { formatCookedAt } from "../../../lib/dates";
import { useThemeColors } from "../../../lib/design/use-theme-colors";
import { trpc } from "../../../lib/trpc";
import { NotificationBell } from "../../../components/notification-bell";
import { TopNav } from "../../../components/top-nav";
import {
  Button,
  Card,
  EmptyState,
  ErrorScreen,
  IconBubble,
  LoadingScreen,
  MealTile,
  PageTitle,
  Screen,
  SectionLabel
} from "../../../components/ui";

/**
 * Round 18 Home tab — editorial rebuild matching the design handoff.
 *
 * Stack, top to bottom:
 *   1. TopNav (Home centered, gear right, no divider).
 *   2. Editorial greeting: italic kicker + big serif name + mono date.
 *   3. "Recently cooked" horizontal carousel of 148pt monogram tiles.
 *   4. "Most cooked" 2-column grid (90pt tile band + name + ×N).
 *   5. "Upcoming plans" section with one plan card + "View all" link.
 *
 * Empty kitchen path renders a single EmptyState with a log CTA.
 * Empty sections collapse — we don't render section labels for empty
 * collections, matching the handoff's editorial restraint.
 */
export default function HomeTab() {
  const colors = useThemeColors();
  const [firstName, setFirstName] = useState<string | null>(null);
  const dashboard = trpc.dashboard.meals.useQuery(undefined, {
    staleTime: 30_000
  });

  useEffect(() => {
    let cancelled = false;
    async function loadName() {
      try {
        const { data } = await authClient.getSession();
        if (cancelled) return;
        if (!data?.user) {
          await clearSessionToken();
          router.replace("/(auth)/sign-in");
          return;
        }
        const raw = (data.user.name ?? data.user.email).trim();
        setFirstName(displayFirstName(raw));
      } catch {
        /* swallow — leave the greeting at "there" */
      }
    }
    void loadName();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dashboard.isPending) {
    return (
      <Screen>
        <TopNav
        title="Home"
        divider={false}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <NotificationBell />
            <Link href="/(authed)/settings" asChild>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={{ padding: 4 }}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.forest}
                />
              </Pressable>
            </Link>
          </View>
        }
      />
        <LoadingScreen />
      </Screen>
    );
  }

  if (dashboard.error) {
    return (
      <Screen>
        <TopNav
        title="Home"
        divider={false}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <NotificationBell />
            <Link href="/(authed)/settings" asChild>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={{ padding: 4 }}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.forest}
                />
              </Pressable>
            </Link>
          </View>
        }
      />
        <ErrorScreen
          title="Couldn't load your kitchen"
          body="Check your connection and pull down to retry."
        />
      </Screen>
    );
  }

  const data = dashboard.data;
  const recent = data?.recentMeals ?? [];
  const mostCooked = data?.mostCookedMeals ?? [];
  const kitchenEmpty = recent.length === 0 && mostCooked.length === 0;

  const now = new Date();

  return (
    <Screen>
      <TopNav
        title="Home"
        divider={false}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <NotificationBell />
            <Link href="/(authed)/settings" asChild>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={{ padding: 4 }}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.forest}
                />
              </Pressable>
            </Link>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isFetching && !dashboard.isPending}
            onRefresh={() => dashboard.refetch()}
            tintColor={colors.forest}
          />
        }
      >
        <View className="px-[22px] mb-7">
          <PageTitle
            size="xl"
            kicker={greetingFor(now)}
            title={`${firstName ?? "there"}.`}
            eyebrow={dateEyebrow(now)}
          />
        </View>

        {kitchenEmpty ? (
          <View className="px-5 pt-2">
            <Card>
              <View className="p-5">
                <EmptyState
                  icon={
                    <Ionicons
                      name="restaurant-outline"
                      size={28}
                      color={colors.forest}
                    />
                  }
                  kicker="A blank slate."
                  title="Your kitchen is empty"
                  body="Log the first meal you've cooked to start your collection."
                  action={
                    <Link href="/(authed)/add" asChild>
                      <Pressable>
                        <Button variant="primary" size="lg">Log a meal</Button>
                      </Pressable>
                    </Link>
                  }
                />
              </View>
            </Card>
          </View>
        ) : (
          <>
            {recent.length > 0 ? (
              <View className="mb-7">
                <View className="px-[22px]">
                  <SectionLabel>Recently cooked</SectionLabel>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingLeft: 22,
                    paddingRight: 22,
                    gap: 12
                  }}
                >
                  {recent.slice(0, 8).map((m) => (
                    <RecentTile
                      key={m.id}
                      mealId={m.mealId}
                      mealName={m.mealName}
                      photoUrl={m.photoUrl}
                      cookedAt={m.cookedAt}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {mostCooked.length > 0 ? (
              <View className="px-[22px] mb-7">
                <SectionLabel>Most cooked</SectionLabel>
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  {mostCooked.slice(0, 4).map((m) => (
                    <MostCookedTile
                      key={m.mealId}
                      mealId={m.mealId}
                      mealName={m.mealName}
                      photoUrl={m.photoUrl}
                      cookCount={m.cookCount}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <PlansSection />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ─── Recently cooked horizontal tile ────────────────────────── */
function RecentTile({
  mealId,
  mealName,
  photoUrl,
  cookedAt
}: {
  mealId: string;
  mealName: string;
  photoUrl: string | null;
  cookedAt: string | Date | null;
}) {
  return (
    <Link href={`/(authed)/meal/${mealId}` as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mealName}, ${formatCookedAt(cookedAt)}`}
        style={{ width: 148 }}
        className="active:opacity-90"
      >
        <View style={{ width: 148, height: 148, marginBottom: 10 }}>
          <MealTile name={mealName} size="xl" photoUrl={photoUrl} radius={10} />
        </View>
        <Text
          className="font-body-semibold text-body-md text-ink dark:text-ink-dark mb-0.5"
          style={{ letterSpacing: -0.1, lineHeight: 18 }}
          numberOfLines={2}
        >
          {mealName}
        </Text>
        <Text
          className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
          style={{ letterSpacing: 0.6 }}
          numberOfLines={1}
        >
          {formatCookedAt(cookedAt)}
        </Text>
      </Pressable>
    </Link>
  );
}

/* ─── Most cooked grid tile ──────────────────────────────────── */
function MostCookedTile({
  mealId,
  mealName,
  photoUrl,
  cookCount
}: {
  mealId: string;
  mealName: string;
  photoUrl: string | null;
  cookCount: number;
}) {
  return (
    <Link href={`/(authed)/meal/${mealId}` as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mealName}, cooked ${cookCount} times`}
        style={{ width: "48%" }}
        className="bg-surface dark:bg-surface-dark rounded-md border border-border-soft dark:border-border-soft-dark overflow-hidden active:opacity-90"
      >
        <View style={{ height: 90 }}>
          <MealTile name={mealName} size="md" photoUrl={photoUrl} radius={0} />
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text
            className="font-body-semibold text-body-sm text-ink dark:text-ink-dark"
            style={{ letterSpacing: -0.1 }}
            numberOfLines={1}
          >
            {mealName}
          </Text>
          <View className="flex-row items-baseline mt-1" style={{ gap: 4 }}>
            <Text
              className="font-display-italic text-kicker text-forest dark:text-forest-dark"
              style={{ lineHeight: 18 }}
            >
              ×{cookCount}
            </Text>
            <Text
              className="font-mono text-eyebrow-xs text-ink-3 dark:text-ink-3-dark uppercase"
              style={{ letterSpacing: 0.5 }}
            >
              cooked
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/* ─── Upcoming plans section ─────────────────────────────────── */
function PlansSection() {
  const colors = useThemeColors();
  const plans = trpc.plans.list.useQuery(undefined, { staleTime: 60_000 });
  const data = plans.data ?? [];
  const featured = data[0];

  if (plans.isPending) {
    return null;
  }

  return (
    <View className="px-[22px]">
      <SectionLabel
        action={
          <Link href="/(authed)/plans" asChild>
            <Pressable hitSlop={6} accessibilityRole="button">
              <Text className="font-body-semibold text-chip text-forest dark:text-forest-dark">
                View all
              </Text>
            </Pressable>
          </Link>
        }
      >
        Upcoming plans
      </SectionLabel>

      {!featured ? (
        <Link href="/(authed)/plans/new" asChild>
          <Pressable>
            <Card variant="interactive">
              <View className="flex-row items-center p-4" style={{ gap: 12 }}>
                <IconBubble size={44}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.forest}
                  />
                </IconBubble>
                <View className="flex-1 gap-1">
                  <Text
                    className="font-body-semibold text-body-lg text-ink dark:text-ink-dark"
                    style={{ letterSpacing: -0.1 }}
                  >
                    Plan an occasion menu
                  </Text>
                  <Text
                    className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
                    style={{ letterSpacing: 0.6 }}
                  >
                    Eid · Diwali · dinner party
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
              </View>
            </Card>
          </Pressable>
        </Link>
      ) : (
        <Link href={`/(authed)/plans/${featured.id}` as never} asChild>
          <Pressable>
            <Card variant="interactive">
              <View className="flex-row items-center p-4" style={{ gap: 12 }}>
                <IconBubble size={44}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.forest}
                  />
                </IconBubble>
                <View className="flex-1 gap-1">
                  <Text
                    className="font-body-semibold text-body-lg text-ink dark:text-ink-dark"
                    style={{ letterSpacing: -0.1 }}
                    numberOfLines={1}
                  >
                    {featured.name}
                  </Text>
                  <Text
                    className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
                    style={{ letterSpacing: 0.6 }}
                  >
                    {planEyebrow(featured.scheduledDate, featured.dishCount)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
              </View>
            </Card>
          </Pressable>
        </Link>
      )}
    </View>
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
  const when = formatCookedAt(new Date(y, m - 1, d));
  return `${when} · ${dishes}`;
}
