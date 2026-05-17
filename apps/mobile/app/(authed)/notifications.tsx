import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View
} from "react-native";
import { formatCookedAt } from "../../lib/dates";
import { useThemeColors } from "../../lib/design/use-theme-colors";
import { trpc } from "../../lib/trpc";
import { TopNav } from "../../components/top-nav";
import {
  EmptyState,
  ErrorScreen,
  LoadingScreen,
  PageTitle,
  Screen
} from "../../components/ui";

/**
 * Round 24 — mobile notifications inbox.
 *
 * Mirrors the information density of web's `notification-bell.tsx`
 * dropdown without the bell-in-header constraint (mobile gets a full
 * screen). Each row: title, body, relative time, unread dot. Tap
 * marks read optimistically and follows the notification's `href`
 * when present (the bell screen on web does the same — deep link or
 * fall through).
 *
 * "Mark all read" lives in the TopNav right slot, mirroring web's
 * dropdown header action.
 *
 * Pull-to-refresh on the list to pick up newly-created notifications
 * (e.g., a household-membership change made from web).
 */
export default function NotificationsScreen() {
  const colors = useThemeColors();
  const utils = trpc.useUtils();
  const listQuery = trpc.notifications.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });

  const markReadMut = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate()
  });
  const markAllMut = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate()
  });

  const rows = listQuery.data?.rows ?? [];
  const unread = listQuery.data?.unreadCount ?? 0;

  function handleRowPress(row: (typeof rows)[number]) {
    if (!row.readAt) {
      // Optimistic: write the read-at into the cache immediately so the
      // dot disappears without waiting for the server round-trip.
      const current = utils.notifications.list.getData();
      if (current) {
        utils.notifications.list.setData(undefined, {
          ...current,
          unreadCount: Math.max(0, current.unreadCount - 1),
          rows: current.rows.map((r) =>
            r.id === row.id ? { ...r, readAt: new Date() } : r
          )
        });
      }
      markReadMut.mutate({ notificationId: row.id });
    }
    if (row.href) {
      // Notifications use web-style paths (`/dashboard`, `/meal/<id>`).
      // Mobile maps the meal-detail and plan-detail prefixes; other
      // paths route to home as a safe default.
      const target = toMobileHref(row.href);
      if (target) router.push(target as never);
    }
  }

  if (listQuery.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Notifications" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  if (listQuery.error) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Notifications" back showSettings={false} />
        <ErrorScreen
          title="Couldn't load notifications"
          body="Pull down to retry."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Notifications"
        back
        showSettings={false}
        right={
          unread > 0 ? (
            <Pressable
              onPress={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Mark all read"
            >
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 14,
                  color: colors.forest,
                  opacity: markAllMut.isPending ? 0.5 : 1
                }}
              >
                Mark all read
              </Text>
            </Pressable>
          ) : null
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18 }}>
            <PageTitle
              kicker="Inbox"
              title={unread > 0 ? `${unread} unread` : "All caught up."}
              size="md"
            />
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: colors.borderSoft,
              marginLeft: 22
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 22, marginTop: 8 }}>
            <EmptyState
              icon={
                <Ionicons
                  name="notifications-outline"
                  size={28}
                  color={colors.forest}
                />
              }
              title="Nothing here yet"
              body="We'll surface household changes, share activity, and milestones as they happen."
            />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={listQuery.isFetching && !listQuery.isPending}
            onRefresh={() => listQuery.refetch()}
            tintColor={colors.forest}
          />
        }
        renderItem={({ item }) => (
          <NotificationRow row={item} onPress={() => handleRowPress(item)} />
        )}
      />
    </Screen>
  );
}

type NotificationRowData = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

function NotificationRow({
  row,
  onPress
}: {
  row: NotificationRowData;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const unread = !row.readAt;
  const created =
    row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread: " : ""}${row.title}`}
      style={({ pressed }) => ({
        paddingHorizontal: 22,
        paddingVertical: 14,
        backgroundColor: pressed ? colors.surface : "transparent",
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start"
      })}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          marginTop: 8,
          backgroundColor: unread ? colors.forest : "transparent"
        }}
        aria-hidden
      />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8
          }}
        >
          <Text
            className="font-body-semibold text-title-md text-ink dark:text-ink-dark"
            style={{ letterSpacing: -0.1, flex: 1 }}
            numberOfLines={1}
          >
            {row.title}
          </Text>
          <Text
            className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
            style={{ letterSpacing: 0.6 }}
          >
            {formatCookedAt(created)}
          </Text>
        </View>
        {row.body ? (
          <Text
            className="font-body text-body-sm text-ink-2 dark:text-ink-2-dark"
            numberOfLines={2}
          >
            {row.body}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Map a notification's web-shaped `href` (`/dashboard`, `/meal/<id>`,
 * `/plans/<id>`) to a mobile route. Falls back to null for paths we
 * don't have a 1:1 mobile equivalent for — caller skips navigation.
 */
function toMobileHref(href: string): string | null {
  if (href === "/dashboard") return "/(authed)/home";
  if (href.startsWith("/meal/")) {
    const id = href.slice("/meal/".length).split("?")[0]?.split("/")[0];
    return id ? `/(authed)/meal/${id}` : null;
  }
  if (href.startsWith("/plans/")) {
    const id = href.slice("/plans/".length).split("?")[0]?.split("/")[0];
    return id ? `/(authed)/plans/${id}` : null;
  }
  if (href === "/settings") return "/(authed)/settings";
  return null;
}
