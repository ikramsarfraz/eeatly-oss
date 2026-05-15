import { Ionicons } from "@expo/vector-icons";
import { Link, Tabs } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

/**
 * Round 17 — authed shell. Three-tab bottom bar (Home / Add / Library)
 * mirrors the web structure but flattened to the platform's standard
 * nav pattern. R17 retunes the visual tokens to match the cream +
 * forest-green design palette.
 *
 * A header settings icon (right) deep-links to `/(authed)/settings`;
 * settings are infrequent and a header icon stays out of the way.
 *
 * Hidden routes (`meal/[id]`, plans/*, household/*, settings) are
 * declared with `href: null` so expo-router can push to them from any
 * tab while keeping them out of the tab bar itself.
 */
export default function AuthedLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2C5F3F",
        tabBarInactiveTintColor: "#9A968A",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E0D5",
          borderTopWidth: StyleSheet.hairlineWidth
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { paddingTop: 6 },
        headerStyle: {
          backgroundColor: "#FBF8F1",
          shadowColor: "transparent",
          elevation: 0
        },
        headerTitleStyle: { fontSize: 16, fontWeight: "600", color: "#1A1F1B" },
        headerTintColor: "#1A1F1B",
        headerRight: () => (
          <Link href="/(authed)/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={12}
              style={{ paddingHorizontal: 16 }}
            >
              <Ionicons name="settings-outline" size={22} color="#2C5F3F" />
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
