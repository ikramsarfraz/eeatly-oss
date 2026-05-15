import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { API_BASE_URL } from "../../lib/api-base";
import { authClient } from "../../lib/auth/client";
import { clearSessionToken } from "../../lib/auth/session";
import { trpc } from "../../lib/trpc";
import {
  Button,
  Card,
  ListItem,
  Screen,
  ScreenCentered,
  SectionHeader,
  Tag
} from "../../components/ui";

/**
 * Round 17 settings — NativeWind rebuild.
 *
 * Intentionally minimal: account snapshot (read-only — name and email
 * edits live on the web), plan badge, kitchen link, advanced web
 * deeplink, and a sign-out button at the bottom. Destructive ops
 * (delete account, manage household ownership, change subscription)
 * stay on web; mobile deep-links to them per Apple's reader-app
 * pattern.
 */
export default function Settings() {
  const [profile, setProfile] = useState<
    { name: string; email: string } | null
  >(null);
  const [loaded, setLoaded] = useState(false);
  const subscription = trpc.billing.currentSubscription.useQuery(undefined, {
    staleTime: 60_000
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await authClient.getSession();
        if (cancelled) return;
        if (data?.user) {
          setProfile({
            name: data.user.name ?? data.user.email,
            email: data.user.email
          });
        }
      } catch {
        /* leave profile null */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await clearSessionToken();
    router.replace("/(auth)/sign-in");
  }

  function openWeb(path: string) {
    void Linking.openURL(`${API_BASE_URL}${path}`);
  }

  const isPlus =
    subscription.data?.status === "active" ||
    subscription.data?.status === "trialing";

  if (!loaded) {
    return (
      <ScreenCentered>
        <ActivityIndicator color="#2C5F3F" />
      </ScreenCentered>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerClassName="pb-12">
        <View className="px-4 pt-4 pb-2">
          <Text className="text-heading-1 font-bold text-foreground">
            Settings
          </Text>
        </View>

        <SectionHeader title="Account" />
        <View className="px-4">
          <Card>
            <ListItem
              title="Name"
              subtitle={profile?.name ?? "—"}
              divider
            />
            <ListItem
              title="Email"
              subtitle={profile?.email ?? "—"}
              divider={false}
            />
          </Card>
        </View>

        <SectionHeader title="Plan" />
        <View className="px-4">
          <Card>
            {subscription.isPending ? (
              <View className="px-4 py-4">
                <ActivityIndicator color="#2C5F3F" />
              </View>
            ) : isPlus ? (
              <View className="flex-row items-center justify-between px-4 py-4">
                <Text className="text-body font-semibold text-foreground">
                  eeatly Plus
                </Text>
                <Tag variant="primary">Active</Tag>
              </View>
            ) : (
              <>
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                  <Text className="text-body text-foreground">Plan</Text>
                  <Tag variant="muted">Free</Tag>
                </View>
                <ListItem
                  title="See Plus features"
                  trailing={
                    <Ionicons
                      name="open-outline"
                      size={18}
                      color="#2C5F3F"
                    />
                  }
                  onPress={() => openWeb("/pricing")}
                  divider={false}
                />
              </>
            )}
          </Card>
        </View>

        <SectionHeader title="Kitchen" />
        <View className="px-4">
          <Card>
            <ListItem
              title="Members + invitations"
              trailing={
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#9A968A"
                />
              }
              onPress={() => router.push("/(authed)/household")}
              divider={false}
            />
          </Card>
        </View>

        <SectionHeader title="Advanced" />
        <View className="px-4">
          <Card>
            <ListItem
              title="Manage account on web"
              subtitle="Edit profile, delete account, subscription"
              trailing={
                <Ionicons name="open-outline" size={18} color="#2C5F3F" />
              }
              onPress={() => openWeb("/settings")}
              divider={false}
            />
          </Card>
        </View>

        <View className="px-4 mt-6">
          <Button variant="secondary" size="md" fullWidth onPress={handleSignOut}>
            Sign out
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
