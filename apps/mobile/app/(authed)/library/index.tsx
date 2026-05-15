import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View
} from "react-native";
import { trpc } from "../../../lib/trpc";
import {
  Card,
  EmptyState,
  ErrorScreen,
  Input,
  LoadingScreen,
  Screen
} from "../../../components/ui";

/**
 * Round 17 — Library tab. Was a stub in R13.
 *
 * Search bar at the top filters the household's meals via
 * `trpc.search.meals`. Empty `q` falls back to the dashboard's
 * "all meals" set (we reuse `dashboard.meals` for the full list
 * to avoid a brand-new procedure).
 *
 * Results render as full-width rows with photo thumbnail, name,
 * and last-cooked subtitle. Tapping a row routes to the meal
 * detail screen.
 *
 * Three empty states:
 *   - no meals at all → "Your kitchen is empty" + log CTA
 *   - active search, zero results → "No meals matched '<query>'"
 *   - search loading after debounce → inline spinner (no full
 *     loader so the search bar stays accessible)
 */
export default function LibraryTab() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    const handle = setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const dashboard = trpc.dashboard.meals.useQuery(undefined, {
    staleTime: 30_000
  });

  const search = trpc.search.meals.useQuery(
    { q: debouncedQuery, limit: 50 },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 30_000
    }
  );

  const searching = debouncedQuery.length >= 2;

  // All meals view = recent + mostCooked + neglected, deduped by id.
  // The dashboard procedure is the cheapest source we have for the
  // household's full meal set right now.
  const allMeals = useMemo(() => {
    if (!dashboard.data) return [];
    const seen = new Set<string>();
    const out: Array<{
      mealId: string;
      mealName: string;
      photoUrl: string | null;
      lastCookedAt: string | Date | null;
    }> = [];
    const add = (
      list: ReadonlyArray<{
        mealId: string;
        mealName: string;
        photoUrl: string | null;
        lastCookedAt?: string | Date | null;
        cookedAt?: string | Date | null;
      }>
    ) => {
      for (const m of list) {
        if (seen.has(m.mealId)) continue;
        seen.add(m.mealId);
        out.push({
          mealId: m.mealId,
          mealName: m.mealName,
          photoUrl: m.photoUrl,
          lastCookedAt: m.lastCookedAt ?? m.cookedAt ?? null
        });
      }
    };
    add(dashboard.data.mostCookedMeals ?? []);
    add(dashboard.data.recentMeals ?? []);
    add(dashboard.data.neglectedMeals ?? []);
    return out;
  }, [dashboard.data]);

  if (dashboard.isPending) {
    return <LoadingScreen />;
  }
  if (dashboard.error) {
    return (
      <ErrorScreen
        title="Couldn't load your library"
        body="Check your connection and try again."
      />
    );
  }

  const searchResults = search.data ?? [];
  const visible = searching
    ? searchResults.map((r) => ({
        mealId: r.id,
        mealName: r.name,
        photoUrl: r.photoUrl ?? null,
        lastCookedAt: null as string | Date | null
      }))
    : allMeals;

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="px-4 pt-4 pb-2">
        <Text className="text-heading-1 font-bold text-foreground">
          Library
        </Text>
        <Text className="text-caption text-foreground-muted mt-1">
          Search your household&apos;s meals.
        </Text>
      </View>

      <View className="px-4 pb-3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name…"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {searching && search.isFetching ? (
        <Text className="px-4 pb-2 text-caption text-foreground-muted">
          Searching…
        </Text>
      ) : null}

      {visible.length === 0 ? (
        searching ? (
          <EmptyState
            icon={<Ionicons name="search" size={28} color="#2C5F3F" />}
            title="No meals matched"
            body={`Nothing found for "${debouncedQuery}". Try a different word.`}
          />
        ) : (
          <EmptyState
            icon={<Ionicons name="restaurant-outline" size={28} color="#2C5F3F" />}
            title="Your kitchen is empty"
            body="Log your first meal to start your collection."
          />
        )
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.mealId}
          contentContainerClassName="px-4 pb-12 gap-2"
          refreshControl={
            <RefreshControl
              refreshing={dashboard.isFetching && !dashboard.isPending}
              onRefresh={() => dashboard.refetch()}
              tintColor="#2C5F3F"
            />
          }
          renderItem={({ item }) => (
            <LibraryRow
              mealId={item.mealId}
              mealName={item.mealName}
              photoUrl={item.photoUrl}
            />
          )}
        />
      )}
    </Screen>
  );
}

function LibraryRow({
  mealId,
  mealName,
  photoUrl
}: {
  mealId: string;
  mealName: string;
  photoUrl: string | null;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mealName}
      onPress={() => router.push(`/(authed)/meal/${mealId}` as never)}
      className="active:opacity-90"
    >
      <Card variant="default">
        <View className="flex-row items-center gap-3 p-3">
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              className="h-14 w-14 rounded-sm bg-background-muted"
              resizeMode="cover"
            />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-sm bg-primary-muted">
              <Ionicons name="restaurant-outline" size={22} color="#2C5F3F" />
            </View>
          )}
          <View className="flex-1">
            <Text
              className="text-body font-semibold text-foreground"
              numberOfLines={1}
            >
              {mealName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9A968A" />
        </View>
      </Card>
    </Pressable>
  );
}
