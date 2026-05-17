import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { TopNav } from "../../../components/top-nav";
import { formatCookedAt } from "../../../lib/dates";
import { useThemeColors } from "../../../lib/design/use-theme-colors";
import { trpc } from "../../../lib/trpc";
import {
  Card,
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  PageTitle,
  Screen
} from "../../../components/ui";

/**
 * Round 18 Library tab — editorial rebuild.
 *
 * TopNav (Library, gear) → big serif "Library" title + subtitle →
 * pill-shape search bar with leading magnifier → horizontal filter
 * chip row (All · N, Recent, …) → list of meal rows (52pt monogram
 * + name + mono "6 DAYS AGO · MEDIUM" eyebrow + chevron).
 *
 * Filters and search both reduce the same dashboard set on the client
 * — we don't push effort into the search procedure for now, since the
 * dashboard already returns the household's meals with their last-cook
 * metadata.
 */
type Filter = "all" | "recent" | "most" | "quick" | "high";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recent" },
  { id: "most", label: "Most cooked" },
  { id: "quick", label: "Quick" },
  { id: "high", label: "High effort" }
];

export default function LibraryTab() {
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

  const allMeals = useMemo(() => {
    if (!dashboard.data) return [];
    const seen = new Map<
      string,
      {
        mealId: string;
        mealName: string;
        photoUrl: string | null;
        lastCookedAt: string | Date | null;
        effort: string | null;
        cookCount: number;
      }
    >();
    const add = (
      list: ReadonlyArray<{
        mealId: string;
        mealName: string;
        photoUrl: string | null;
        lastCookedAt?: string | Date | null;
        cookedAt?: string | Date | null;
        effortLevel?: string | null;
        cookCount?: number | null;
      }>
    ) => {
      for (const m of list) {
        if (seen.has(m.mealId)) continue;
        seen.set(m.mealId, {
          mealId: m.mealId,
          mealName: m.mealName,
          photoUrl: m.photoUrl,
          lastCookedAt: m.lastCookedAt ?? m.cookedAt ?? null,
          effort: m.effortLevel ?? null,
          cookCount: m.cookCount ?? 0
        });
      }
    };
    add(dashboard.data.mostCookedMeals ?? []);
    add(dashboard.data.recentMeals ?? []);
    add(dashboard.data.neglectedMeals ?? []);
    return Array.from(seen.values());
  }, [dashboard.data]);

  const visible = useMemo(() => {
    if (searching) {
      return (search.data ?? []).map((r) => ({
        mealId: r.id,
        mealName: r.name,
        photoUrl: r.photoUrl ?? null,
        lastCookedAt: null as string | Date | null,
        effort: null as string | null,
        cookCount: 0
      }));
    }
    switch (filter) {
      case "recent":
        return [...allMeals].sort((a, b) => {
          const t = (v: string | Date | null) =>
            v ? new Date(v).getTime() : 0;
          return t(b.lastCookedAt) - t(a.lastCookedAt);
        });
      case "most":
        return [...allMeals].sort((a, b) => b.cookCount - a.cookCount);
      case "quick":
        return allMeals.filter((m) => m.effort === "quick" || m.effort === "easy");
      case "high":
        return allMeals.filter((m) => m.effort === "high_effort");
      case "all":
      default:
        return allMeals;
    }
  }, [searching, search.data, filter, allMeals]);

  if (dashboard.isPending) {
    return (
      <Screen>
        <TopNav title="Library" />
        <LoadingScreen />
      </Screen>
    );
  }
  if (dashboard.error) {
    return (
      <Screen>
        <TopNav title="Library" />
        <ErrorScreen
          title="Couldn't load your library"
          body="Check your connection and try again."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopNav title="Library" />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.mealId}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18 }}>
              <PageTitle
                title="Library"
                size="md"
                subtitle="Every meal cooked in your kitchen."
              />
            </View>

            <View style={{ paddingHorizontal: 22, marginBottom: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.sageDeep,
                  borderRadius: 99,
                  paddingHorizontal: 16,
                  paddingVertical: 10
                }}
              >
                <Ionicons name="search" size={18} color={colors.ink3} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by name…"
                  placeholderTextColor={colors.ink3}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={{
                    flex: 1,
                    fontFamily: "Geist_400Regular",
                    fontSize: 14.5,
                    color: colors.ink,
                    paddingVertical: 0
                  }}
                />
              </View>
            </View>

            {!searching ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 22,
                  gap: 8
                }}
                style={{ marginBottom: 18 }}
              >
                {FILTERS.map((f) => {
                  const on = filter === f.id;
                  const label =
                    f.id === "all" ? `All · ${allMeals.length}` : f.label;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setFilter(f.id)}
                      style={{
                        paddingHorizontal: 13,
                        paddingVertical: 7,
                        borderRadius: 99,
                        backgroundColor: on ? colors.sageBg : "transparent",
                        borderWidth: on ? 0 : 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Geist_600SemiBold",
                          fontSize: 12.5,
                          color: on ? colors.forest : colors.ink2,
                          letterSpacing: -0.1
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          searching ? (
            <EmptyState
              icon={
                <Ionicons name="search" size={28} color={colors.forest} />
              }
              title="No meals matched"
              body={`Nothing found for "${debouncedQuery}". Try a different word.`}
            />
          ) : (
            <EmptyState
              icon={
                <Ionicons
                  name="restaurant-outline"
                  size={28}
                  color={colors.forest}
                />
              }
              title="Your kitchen is empty"
              body="Log your first meal to start your collection."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isFetching && !dashboard.isPending}
            onRefresh={() => dashboard.refetch()}
            tintColor={colors.forest}
          />
        }
        renderItem={({ item }) => (
          <LibraryRow
            mealId={item.mealId}
            mealName={item.mealName}
            photoUrl={item.photoUrl}
            lastCookedAt={item.lastCookedAt}
            effort={item.effort}
          />
        )}
      />
    </Screen>
  );
}

function LibraryRow({
  mealId,
  mealName,
  photoUrl,
  lastCookedAt,
  effort
}: {
  mealId: string;
  mealName: string;
  photoUrl: string | null;
  lastCookedAt: string | Date | null;
  effort: string | null;
}) {
  const colors = useThemeColors();
  const eyebrow = buildEyebrow(lastCookedAt, effort);
  return (
    <Link href={`/(authed)/meal/${mealId}` as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mealName}
        className="active:opacity-90"
      >
        <Card>
          <View
            className="flex-row items-center"
            style={{ gap: 12, padding: 10 }}
          >
            <View style={{ width: 52, height: 52 }}>
              <MealTile name={mealName} size="sm" photoUrl={photoUrl} radius={8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                style={{ letterSpacing: -0.1, marginBottom: 2 }}
                numberOfLines={1}
              >
                {mealName}
              </Text>
              {eyebrow ? (
                <Text
                  className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
                  style={{ letterSpacing: 0.5 }}
                  numberOfLines={1}
                >
                  {eyebrow}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function buildEyebrow(
  lastCookedAt: string | Date | null,
  effort: string | null
): string | null {
  const parts: string[] = [];
  if (lastCookedAt) parts.push(formatCookedAt(lastCookedAt));
  if (effort) {
    const map: Record<string, string> = {
      quick: "quick",
      easy: "easy",
      medium: "medium",
      high_effort: "high"
    };
    const label = map[effort];
    if (label) parts.push(label);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
