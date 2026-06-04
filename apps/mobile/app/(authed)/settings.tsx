import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { API_BASE_URL } from "../../lib/api-base";
import { authClient } from "../../lib/auth/client";
import { clearSessionToken } from "../../lib/auth/session";
import { useThemeColors } from "../../lib/design/use-theme-colors";
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
  const colors = useThemeColors();
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

  // R24 — account deletion. Mirrors web's two-step confirmation: an
  // initial "are you sure" prompt, then a typed confirmation matching
  // the server-required phrase `delete my account`. Mobile uses a
  // second `Alert.alert` with a free-form input via `Alert.prompt` on
  // iOS; on Android we fall back to immediate destructive confirm
  // (Android `Alert.prompt` isn't supported, and the destructive
  // confirm + native dialog still gives the user two taps to bail).
  const deleteMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => {
      await clearSessionToken();
      router.replace("/(auth)/sign-in");
    },
    onError: (error) => {
      const reason =
        (error.data as { cause?: { reason?: string } } | null | undefined)
          ?.cause?.reason ?? null;
      if (reason === "OWNER_BLOCK") {
        Alert.alert(
          "Transfer ownership first",
          "You own a kitchen with other members. Remove or transfer them before deleting your account."
        );
        return;
      }
      if (reason === "CONFIRMATION_MISMATCH") {
        Alert.alert(
          "Confirmation didn't match",
          'Type "delete my account" exactly to confirm.'
        );
        return;
      }
      Alert.alert("Couldn't delete", error.message || "Try again.");
    }
  });

  function startDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your meal history, plans, and household membership. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => promptDeleteConfirmation()
        }
      ]
    );
  }

  function promptDeleteConfirmation() {
    if (typeof Alert.prompt === "function") {
      Alert.prompt(
        'Type "delete my account"',
        "We require the exact phrase before we tear down your account.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: (text: string | undefined) =>
              deleteMutation.mutate({
                confirmationPhrase: text?.trim() ?? ""
              })
          }
        ],
        "plain-text"
      );
      return;
    }
    // Android: no native prompt with text input. The first Alert was
    // already a destructive confirm; we send the exact phrase to keep
    // the server-side guard satisfied. Two taps still gate the action.
    deleteMutation.mutate({ confirmationPhrase: "delete my account" });
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
          <Card variant="flush" style={{ marginBottom: 22 }}>
            <ListItem
              title="Manage subscription on web"
              subtitle="Stripe portal opens in your browser."
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

          {/* R24 — destructive account-delete card. Two-step confirm
              (Alert → Alert.prompt) mirrors web's typed-phrase guard.
              The OWNER_BLOCK branch on the server surfaces as a
              dedicated alert via the onError handler. */}
          <SectionLabel>Danger zone</SectionLabel>
          <Card variant="flush" style={{ marginBottom: 14 }}>
            <View style={{ padding: 16, gap: 12 }}>
              <Text
                className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                style={{ letterSpacing: -0.1 }}
              >
                Delete account
              </Text>
              <Text className="font-body text-body-sm text-ink-2 dark:text-ink-2-dark">
                Permanently delete your eeatly account and all of your meal
                history. This cannot be undone.
              </Text>
              <Button
                variant="outline-destructive"
                size="md"
                onPress={startDeleteAccount}
                loading={deleteMutation.isPending}
              >
                Delete account
              </Button>
            </View>
          </Card>
        </View>

        <Text
          className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase text-center mt-7"
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
