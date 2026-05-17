import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "../lib/design/use-theme-colors";
import { trpc } from "../lib/trpc";

/**
 * Round 24 — bell affordance for the home screen TopNav `right` slot.
 *
 * Shares the `notifications.list` query cache with the inbox screen, so
 * the badge stays in sync with the inbox without an extra round-trip.
 * `unreadCount` rides in the procedure response — no client-side
 * derivation needed.
 *
 * The bell is the only top-right affordance on home; settings is
 * already accessible via Settings → Account, and the design system's
 * editorial `PageTitle` greeting carries the visual weight of the
 * page header.
 */
export function NotificationBell() {
  const colors = useThemeColors();
  const query = trpc.notifications.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
  const unread = query.data?.unreadCount ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/(authed)/notifications" as never)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0
          ? `Notifications, ${unread} unread`
          : "Notifications"
      }
      style={{ padding: 4 }}
    >
      <View style={{ position: "relative" }}>
        <Ionicons name="notifications-outline" size={22} color={colors.forest} />
        {unread > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 99,
              paddingHorizontal: 4,
              backgroundColor: colors.danger,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 10,
                lineHeight: 12,
                color: colors.forestText
              }}
            >
              {unread > 9 ? "9+" : String(unread)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
