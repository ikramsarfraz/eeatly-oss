import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { API_BASE_URL } from "../../lib/api-base";
import { authClient } from "../../lib/auth/client";
import { clearSessionToken } from "../../lib/auth/session";
import { colors } from "../../lib/design/tokens";
import { trpc } from "../../lib/trpc";
import { TopNav } from "../../components/top-nav";
import {
  Button,
  Card,
  Chip,
  ListItem,
  PageTitle,
  Screen,
  ScreenCentered,
  SectionLabel
} from "../../components/ui";

/**
 * Round 18 settings — editorial rebuild.
 *
 * TopNav (Settings, back, no gear) → big serif "Settings" → grouped
 * ACCOUNT / PLAN / KITCHEN / ADVANCED cards with mono-aligned values
 * → footer "EEATLY · V2.1" → bottom Sign out CTA.
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
        <ActivityIndicator color={colors.forest} />
      </ScreenCentered>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav title="Settings" back showSettings={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 22, paddingTop: 12, marginBottom: 22 }}>
          <PageTitle title="Settings" size="md" />
        </View>

        <View style={{ paddingHorizontal: 22 }}>
          <SectionLabel>Account</SectionLabel>
          <Card variant="flush" style={{ marginBottom: 22 }}>
            <ListItem
              title="Name"
              value={profile?.name ?? "—"}
              divider={false}
            />
            <ListItem
              title="Email"
              value={profile?.email ?? "—"}
              divider
            />
          </Card>

          <SectionLabel>Plan</SectionLabel>
          <Card variant="flush" style={{ marginBottom: 22 }}>
            {subscription.isPending ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <ActivityIndicator color={colors.forest} />
              </View>
            ) : isPlus ? (
              <ListItem
                title="Current plan"
                trailing={<Chip tone="sage">eeatly Plus</Chip>}
                divider={false}
              />
            ) : (
              <>
                <ListItem
                  title="Current plan"
                  trailing={<Chip tone="ghost">Free</Chip>}
                  divider={false}
                />
                <ListItem
                  title="See Plus features"
                  trailing={
                    <Ionicons
                      name="open-outline"
                      size={16}
                      color={colors.forest}
                    />
                  }
                  onPress={() => openWeb("/pricing")}
                  divider
                />
              </>
            )}
          </Card>

          <SectionLabel>Kitchen</SectionLabel>
          <Card variant="flush" style={{ marginBottom: 22 }}>
            <ListItem
              title="Members + invitations"
              subtitle="Just you · 1 pending invite"
              trailing={
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.ink3}
                />
              }
              onPress={() => router.push("/(authed)/household")}
              divider={false}
            />
          </Card>

          <SectionLabel>Advanced</SectionLabel>
          <Card variant="flush">
            <ListItem
              title="Manage account on web"
              subtitle="Edit profile, delete account, subscription."
              trailing={
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={colors.forest}
                />
              }
              onPress={() => openWeb("/settings")}
              divider={false}
            />
          </Card>
        </View>

        <Text
          className="font-mono text-eyebrow text-ink-3 uppercase text-center mt-7"
          style={{ letterSpacing: 1.4 }}
        >
          eeatly · v2.1
        </Text>

        <View style={{ paddingHorizontal: 22, marginTop: 22, alignItems: "stretch" }}>
          <Button variant="secondary" size="md" fullWidth onPress={handleSignOut}>
            Sign out
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
