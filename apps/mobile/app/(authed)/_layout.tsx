import { Tabs } from "expo-router";
import { EeatlyTabBar } from "../../components/tab-bar";

/**
 * Round 18 — authed shell with the redesigned bottom tab bar.
 *
 * The native header is suppressed across all three visible tabs — each
 * screen renders its own editorial page title in the body, anchored to
 * the warm cream background. The custom `EeatlyTabBar` handles the
 * sage-bg active pill, the filled vs outline icon swap, and the Geist
 * weight bump for the active label.
 *
 * Hidden routes (`meal/[id]`, plans/*, household/*, settings) are
 * declared with `href: null` so expo-router can still push into them
 * from any tab while keeping them out of the visible tab list.
 */
export default function AuthedLayout() {
  return (
    <Tabs
      tabBar={(props) => <EeatlyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home/index" options={{ title: "Home" }} />
      <Tabs.Screen name="add/index" options={{ title: "Add" }} />
      <Tabs.Screen name="library/index" options={{ title: "Library" }} />
      <Tabs.Screen name="meal/[id]" options={{ href: null }} />
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
    </Tabs>
  );
}
