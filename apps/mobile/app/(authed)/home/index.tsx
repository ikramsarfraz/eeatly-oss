import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { authClient } from "../../../lib/auth/client";
import { clearSessionToken } from "../../../lib/auth/session";
import { formatCookCount, formatCookedAt } from "../../../lib/dates";
import { trpc } from "../../../lib/trpc";
import { MealCard } from "../../../components/meal-card";
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionHeader
} from "../../../components/ui";

/**
 * Round 17 home tab — rebuilt with NativeWind primitives.
 *
 * Layout from top:
 *   1. Greeting (heading-1) + today's date caption.
 *   2. Three horizontally-scrolling sections of MealCard tiles —
 *      Recent, Most cooked, Bring it back (with accent border).
 *   3. Plans summary card with a "View all plans" link.
 *
 * Empty-kitchen path renders a single EmptyState with a "Log a meal"
 * CTA. Empty section state collapses the section entirely rather
 * than rendering a row of italic text — the section header itself
 * disappears unless there's content.
 */
export default function HomeTab() {
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
        const first = raw.split(/\s+/)[0] ?? raw;
        setFirstName(first);
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
    return <LoadingScreen />;
  }

  if (dashboard.error) {
    return (
      <ErrorScreen
        title="Couldn't load your kitchen"
        body="Check your connection and pull down to retry."
      />
    );
  }

  const data = dashboard.data;
  const recent = data?.recentMeals ?? [];
  const mostCooked = data?.mostCookedMeals ?? [];
  const neglected = data?.neglectedMeals ?? [];
  const kitchenEmpty = recent.length === 0 && mostCooked.length === 0;

  const today = format(new Date(), "EEEE, MMM d");

  return (
    <Screen edges={["top", "bottom"]}>
      <ScrollView
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isFetching && !dashboard.isPending}
            onRefresh={() => dashboard.refetch()}
            tintColor="#2C5F3F"
          />
        }
      >
        <View className="px-4 pt-4 pb-2 gap-1">
          <Text className="text-heading-1 font-bold text-foreground">
            Hello, {firstName ?? "there"}.
          </Text>
          <Text className="text-caption text-foreground-muted">{today}</Text>
        </View>

        {kitchenEmpty ? (
          <View className="px-4 pt-8">
            <Card variant="default">
              <CardBody>
                <EmptyState
                  icon={
                    <Ionicons
                      name="restaurant-outline"
                      size={28}
                      color="#2C5F3F"
                    />
                  }
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
              </CardBody>
            </Card>
          </View>
        ) : (
          <>
            {recent.length > 0 ? (
              <HorizontalSection title="Recent meals">
                {recent.slice(0, 8).map((m) => (
                  <MealCard
                    key={m.id}
                    mealId={m.mealId}
                    mealName={m.mealName}
                    photoUrl={m.photoUrl}
                    subtitle={formatCookedAt(m.cookedAt)}
                  />
                ))}
              </HorizontalSection>
            ) : null}

            {mostCooked.length > 0 ? (
              <HorizontalSection title="Most cooked">
                {mostCooked.slice(0, 8).map((m) => (
                  <MealCard
                    key={m.mealId}
                    mealId={m.mealId}
                    mealName={m.mealName}
                    photoUrl={m.photoUrl}
                    subtitle={formatCookCount(m.cookCount)}
                  />
                ))}
              </HorizontalSection>
            ) : null}

            {neglected.length > 0 ? (
              <HorizontalSection title="Bring it back">
                {neglected.slice(0, 8).map((m) => (
                  <MealCard
                    key={m.mealId}
                    mealId={m.mealId}
                    mealName={m.mealName}
                    photoUrl={m.photoUrl}
                    subtitle={`Last ${formatCookedAt(m.lastCookedAt)}`}
                    accent
                  />
                ))}
              </HorizontalSection>
            ) : null}

            <PlansSection />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function HorizontalSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <SectionHeader title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 gap-3 pb-1"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function PlansSection() {
  const plans = trpc.plans.list.useQuery(undefined, { staleTime: 60_000 });
  const data = plans.data ?? [];
  const featured = data[0];

  return (
    <View className="mt-2">
      <SectionHeader
        title="Plans"
        action={
          <Link href="/(authed)/plans" asChild>
            <Pressable hitSlop={6} accessibilityRole="button">
              <Text className="text-caption-strong font-semibold text-primary">
                View all
              </Text>
            </Pressable>
          </Link>
        }
      />
      <View className="px-4">
        {plans.isPending ? (
          <Card>
            <CardBody>
              <Text className="text-caption text-foreground-muted">
                Loading…
              </Text>
            </CardBody>
          </Card>
        ) : !featured ? (
          <Link href="/(authed)/plans/new" asChild>
            <Pressable>
              <Card variant="interactive">
                <CardBody>
                  <Text className="text-heading-3 font-semibold text-foreground">
                    Plan an occasion menu
                  </Text>
                  <Text className="text-caption text-foreground-muted mt-1">
                    Build a menu for the next Eid, Diwali, or dinner party.
                  </Text>
                  <Text className="text-caption-strong font-semibold text-primary mt-3">
                    Create your first plan →
                  </Text>
                </CardBody>
              </Card>
            </Pressable>
          </Link>
        ) : (
          <Link href={`/(authed)/plans/${featured.id}` as never} asChild>
            <Pressable>
              <Card variant="interactive">
                <CardBody>
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <Text
                        className="text-heading-3 font-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {featured.name}
                      </Text>
                      <Text className="text-caption text-foreground-muted">
                        {featured.dishCount === 0
                          ? "No dishes yet"
                          : featured.dishCount === 1
                            ? "1 dish"
                            : `${featured.dishCount} dishes`}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9A968A"
                    />
                  </View>
                </CardBody>
              </Card>
            </Pressable>
          </Link>
        )}
      </View>
    </View>
  );
}
