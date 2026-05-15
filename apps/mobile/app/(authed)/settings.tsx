import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../lib/api-base";
import { authClient } from "../../lib/auth/client";
import { clearSessionToken } from "../../lib/auth/session";
import { trpc } from "../../lib/trpc";

/**
 * Round 13 — settings tab. Intentionally minimal per the handoff:
 *   - Account: name + email (read-only here; edits live on web)
 *   - Plan: shows "Plus" if subscribed, otherwise a CTA that
 *     deep-links to the web `/pricing` page (Apple reader-app pattern
 *     — IAP is explicitly out of scope)
 *   - "Manage account on web" link for advanced changes
 *   - Sign out
 *
 * No account management UI here. Web is the source of truth for
 * destructive operations (delete account, household management,
 * subscription changes); mobile just deep-links over to them.
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
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <Row label="Name" value={profile?.name ?? "—"} />
          <Row label="Email" value={profile?.email ?? "—"} />
        </Section>

        <Section title="Plan">
          {subscription.isPending ? (
            <View style={styles.row}>
              <ActivityIndicator />
            </View>
          ) : isPlus ? (
            <Row label="eeatly Plus" value="Active" />
          ) : (
            <>
              <Row label="Plan" value="Free" />
              <LinkRow
                label="See Plus features"
                onPress={() => openWeb("/pricing")}
              />
            </>
          )}
        </Section>

        <Section title="Advanced">
          <LinkRow
            label="Manage account on web"
            onPress={() => openWeb("/settings")}
          />
        </Section>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Text style={styles.linkArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdfdfa"
  },
  content: { paddingVertical: 16, gap: 24 },
  section: {},
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
    gap: 12
  },
  rowPressed: {
    backgroundColor: "#f5f4ef"
  },
  rowLabel: {
    fontSize: 14,
    color: "#444"
  },
  rowValue: {
    fontSize: 14,
    color: "#111",
    flexShrink: 1,
    textAlign: "right"
  },
  linkText: {
    fontSize: 14,
    color: "#2f6f58",
    fontWeight: "500"
  },
  linkArrow: {
    fontSize: 18,
    color: "#999"
  },
  signOut: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderColor: "#ccc",
    borderWidth: 1
  },
  signOutPressed: {
    backgroundColor: "#f5f5f5"
  },
  signOutText: {
    color: "#444",
    fontSize: 14,
    fontWeight: "500"
  }
});
