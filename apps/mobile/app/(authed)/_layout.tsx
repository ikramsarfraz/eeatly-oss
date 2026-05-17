import { Redirect, Tabs, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useThemeColors } from "../../lib/design/use-theme-colors";
import { trpc } from "../../lib/trpc";
import { EeatlyTabBar } from "../../components/tab-bar";
import { ONBOARDING_ROUTE_NAME } from "./onboarding";

/**
 * Round 18/24 — authed shell with the redesigned bottom tab bar.
 *
 * The native header is suppressed across all three visible tabs — each
 * screen renders its own editorial page title in the body, anchored to
 * the warm cream background. The custom `EeatlyTabBar` handles the
 * sage-bg active pill, the filled vs outline icon swap, and the Geist
 * weight bump for the active label.
 *
 * Hidden routes (`meal/[id]`, plans/*, household/*, settings,
 * notifications, onboarding) are declared with `href: null` so
 * expo-router can still push into them from any tab while keeping
 * them out of the visible tab list.
 *
 * Round 24 — onboarding gate. The layout queries `onboarding.status`
 * once per mount; until the user has completed onboarding, every
 * authed route (except onboarding itself) redirects to
 * `/(authed)/onboarding`. The gate uses expo-router's `<Redirect>`
 * rather than conditional rendering so URL state stays honest under
 * deep-linking + back-navigation.
 */
export default function AuthedLayout() {
  const colors = useThemeColors();
  const segments = useSegments() as string[];
  const onOnboarding = segments.includes(ONBOARDING_ROUTE_NAME);

  // Query the gate. `staleTime: Infinity` keeps the result cached for
  // the session — the only way it flips from "incomplete" to "complete"
  // is via the onboarding screen itself, which invalidates the query
  // before navigating out.
  const statusQuery = trpc.onboarding.status.useQuery(undefined, {
    staleTime: Infinity,
    retry: 1
  });

  if (statusQuery.isPending) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cream
        }}
      >
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!statusQuery.data?.completed && !onOnboarding) {
    return <Redirect href={"/(authed)/onboarding" as never} />;
  }

  return (
    <Tabs
      tabBar={(props) => <EeatlyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home/index" options={{ title: "Home" }} />
      <Tabs.Screen name="add/index" options={{ title: "Add" }} />
      <Tabs.Screen name="library/index" options={{ title: "Library" }} />
      <Tabs.Screen name="meal/[id]/index" options={{ href: null }} />
      <Tabs.Screen
        name="meal/[id]/refine/index"
        options={{ href: null, title: "Refine recipe" }}
      />
      <Tabs.Screen
        name="meal/[id]/refine/review"
        options={{ href: null, title: "Review changes" }}
      />
      <Tabs.Screen
        name="add/log"
        options={{ href: null, title: "Log a meal" }}
      />
      <Tabs.Screen
        name="add/ai-suggest"
        options={{ href: null, title: "AI capture" }}
      />
      <Tabs.Screen
        name="plans/index"
        options={{ href: null, title: "Plans" }}
      />
      <Tabs.Screen
        name="plans/new"
        options={{ href: null, title: "New plan" }}
      />
      <Tabs.Screen
        name="plans/[id]/index"
        options={{ href: null, title: "Plan" }}
      />
      <Tabs.Screen
        name="plans/[id]/edit"
        options={{ href: null, title: "Edit plan" }}
      />
      <Tabs.Screen
        name="household/index"
        options={{ href: null, title: "Kitchen" }}
      />
      <Tabs.Screen
        name="household/invite"
        options={{ href: null, title: "Invite" }}
      />
      <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: "Notifications" }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null, title: "Welcome" }}
      />
    </Tabs>
  );
}
