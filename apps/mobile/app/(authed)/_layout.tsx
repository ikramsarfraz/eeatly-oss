import { Ionicons } from "@expo/vector-icons";
import { Link, Tabs } from "expo-router";
import { Pressable } from "react-native";

/**
 * Round 13 — authed shell. Three-tab bottom bar (Home / Add / Library)
 * mirrors the structure web uses but flattened to the platform's
 * standard nav pattern. A header settings icon (right) deep-links to
 * `/(authed)/settings`; we don't need a tab for it because settings
 * are infrequent and a header icon stays out of the way of the
 * primary kitchen flows.
 *
 * The Add tab is the entry point for both manual logging and AI
 * capture (Tasks 3 + 4). Library is browse/search (Task 1 ships a
 * placeholder; richer search lands when there's data to search
 * against, currently uses `search.meals`).
 *
 * `meal/[id]` is intentionally absent from `<Tabs>` — it's a stack
 * screen that pushes from any tab and shows its own back button.
 * Same with `settings`. Both must be declared as `Tabs.Screen` with
 * `href: null` to register the route while hiding the tab.
 */
export default function AuthedLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2f6f58",
        tabBarInactiveTintColor: "#7a7a7a",
        headerStyle: { backgroundColor: "#fdfdfa" },
        headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        headerRight: () => (
          <Link href="/(authed)/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={12}
              style={{ paddingHorizontal: 16 }}
            >
              <Ionicons name="settings-outline" size={22} color="#444" />
            </Pressable>
          </Link>
        )
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="add/index"
        options={{
          title: "Add",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size + 2} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="library/index"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          )
        }}
      />
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
