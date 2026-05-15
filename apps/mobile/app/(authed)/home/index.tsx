import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../../lib/auth/client";
import { clearSessionToken } from "../../../lib/auth/session";
import { formatCookCount, formatCookedAt } from "../../../lib/dates";
import { trpc } from "../../../lib/trpc";
import { MealTile } from "../../../components/meal-tile";

/**
 * Round 13 — home tab. Recreates web's dashboard sections on phone:
 * recent meals, most cooked, neglected. One tRPC query
 * (`dashboard.meals`) returns all three lists in a single round-trip
 * — same shape web's RSC dashboard uses, so we get parity for free.
 *
 * Greeting pulls from `authClient.getSession()`. On 401 (stored
 * bearer token revoked or expired) we clear SecureStore and bounce
 * to sign-in — same behaviour as the R12 placeholder screen.
 *
 * Pull-to-refresh re-fetches the dashboard query.
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
        // Display the first word of the stored name (or the email
        // local-part as a fallback). Trim aggressively so a typo'd
        // name with leading spaces doesn't render as "Hello,  ."
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
    return (
      <SafeAreaView style={styles.loading} edges={["bottom"]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const data = dashboard.data;
  const recent = data?.recentMeals ?? [];
  const mostCooked = data?.mostCookedMeals ?? [];
  const neglected = data?.neglectedMeals ?? [];

  // Empty kitchen — no recent + no mostCooked. Send straight to the
  // log-first-meal CTA. Neglected is intentionally omitted from the
  // check; "no neglected meals" is the steady state, not an empty
  // kitchen signal.
  const kitchenEmpty = recent.length === 0 && mostCooked.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isFetching && !dashboard.isPending}
            onRefresh={() => dashboard.refetch()}
            tintColor="#2f6f58"
          />
        }
      >
        <Text style={styles.greeting}>Hello, {firstName ?? "there"}.</Text>

        {dashboard.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Couldn't load your kitchen. Pull down to retry.
            </Text>
          </View>
        ) : null}

        {kitchenEmpty ? (
          <EmptyKitchenCTA />
        ) : (
          <>
            <Section title="Recent">
              {recent.length === 0 ? (
                <SectionEmpty text="No recent cooks yet." />
              ) : (
                recent.slice(0, 5).map((m) => (
                  <MealTile
                    key={m.id}
                    mealId={m.mealId}
                    mealName={m.mealName}
                    photoUrl={m.photoUrl}
                    subtitle={formatCookedAt(m.cookedAt)}
                  />
                ))
              )}
            </Section>

            {mostCooked.length > 0 ? (
              <Section title="Most cooked">
                {mostCooked.slice(0, 5).map((m) => (
                  <MealTile
                    key={m.mealId}
                    mealId={m.mealId}
                    mealName={m.mealName}
                    photoUrl={m.photoUrl}
                    subtitle={formatCookCount(m.cookCount)}
                  />
                ))}
              </Section>
            ) : null}

            {neglected.length > 0 ? (
              <Section title="Worth bringing back">
                {neglected.slice(0, 5).map((m) => (
                  <MealTile
                    key={m.mealId}
                    mealId={m.mealId}
                    mealName={m.mealName}
                    photoUrl={m.photoUrl}
                    subtitle={`Last ${formatCookedAt(m.lastCookedAt)}`}
                  />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SectionEmpty({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function EmptyKitchenCTA() {
  return (
    <View style={styles.emptyKitchen}>
      <Text style={styles.emptyKitchenTitle}>Your kitchen is empty.</Text>
      <Text style={styles.emptyKitchenBody}>
        Log the first meal you've cooked recently to start your collection.
      </Text>
      <Link href="/(authed)/add" asChild>
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>Log a meal</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfa"
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdfdfa"
  },
  scrollContent: {
    paddingBottom: 24
  },
  greeting: {
    fontSize: 28,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    color: "#111"
  },
  errorBox: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fdecea"
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13
  },
  section: {
    paddingTop: 16
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#666",
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  sectionBody: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  emptyRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff"
  },
  emptyText: {
    color: "#888",
    fontSize: 13,
    fontStyle: "italic"
  },
  emptyKitchen: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    gap: 12
  },
  emptyKitchenTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111"
  },
  emptyKitchenBody: {
    fontSize: 14,
    color: "#555",
    textAlign: "center"
  },
  ctaButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2f6f58",
    minHeight: 44
  },
  ctaPressed: {
    opacity: 0.85
  },
  ctaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  }
});
