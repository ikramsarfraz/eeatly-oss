import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { authClient } from "../../lib/auth/client";
import { clearSessionToken } from "../../lib/auth/session";
import { trpc } from "../../lib/trpc";

/**
 * Round 12 Task 6 — first authenticated screen. Proof-of-life that
 * the full mobile stack works end-to-end:
 *
 *   bearer token (SecureStore) → tRPC client → CORS-allowed origin →
 *   Next.js fetch adapter → bearer-plugin session lookup → procedure
 *
 * Two probes:
 *   1. `authClient.getSession()` — Better Auth returns the current user
 *      (name + email). If null, the stored token is invalid/expired and
 *      we bounce back to sign-in (the only graceful path off this
 *      screen with a stale token).
 *   2. `trpc.health.ping.useQuery()` — round-trips through the tRPC
 *      stack. The returned `at: Date` survives superjson rehydration,
 *      proving the transformer chain matches.
 *
 * Phase-1 styling: raw RN primitives. The eeatly-Plus visual identity
 * comes when there are real features here in R13+.
 */
export default function AuthedHome() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const ping = trpc.health.ping.useQuery(undefined, {
    // Refresh on screen focus, but don't hammer — a single probe per
    // mount + the explicit refetch button is enough for Phase 1.
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await authClient.getSession();
        if (cancelled) return;
        if (!data?.user) {
          // Bearer token didn't resolve to a session — typically means
          // it expired or was revoked server-side. Clear it locally and
          // route back to sign-in so the user can request a fresh link.
          await clearSessionToken();
          router.replace("/(auth)/sign-in");
          return;
        }
        setUser({
          name: data.user.name ?? data.user.email,
          email: data.user.email
        });
      } catch {
        // Network failure or server error. Don't sign the user out —
        // leave them on this screen with no name; pulldown / retry
        // can recover. The ping probe below also surfaces a clear
        // error in this case.
      } finally {
        if (!cancelled) setUserLoaded(true);
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

  if (!userLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hello, {user?.name ?? "friend"}.</Text>
      {user?.email && user.email !== user.name ? (
        <Text style={styles.email}>{user.email}</Text>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Backend says:</Text>
        {ping.isPending ? (
          <ActivityIndicator />
        ) : ping.error ? (
          <Text style={styles.statusError}>{ping.error.message}</Text>
        ) : (
          <Text style={styles.statusOk}>
            {ping.data.status} ({ping.data.at.toLocaleTimeString()})
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => ping.refetch()}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>Re-ping</Text>
      </Pressable>

      <View style={styles.spacer} />

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  greeting: {
    fontSize: 28,
    fontWeight: "600"
  },
  email: {
    fontSize: 14,
    color: "#666"
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e5e5",
    marginVertical: 12
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusLabel: {
    fontSize: 14,
    color: "#444"
  },
  statusOk: {
    fontSize: 14,
    color: "#2f6f58",
    fontWeight: "500"
  },
  statusError: {
    fontSize: 13,
    color: "#b91c1c"
  },
  secondary: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderColor: "#2f6f58",
    borderWidth: 1
  },
  secondaryText: {
    color: "#2f6f58",
    fontSize: 13,
    fontWeight: "500"
  },
  pressed: {
    opacity: 0.7
  },
  spacer: {
    flex: 1
  },
  signOut: {
    paddingVertical: 12,
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
