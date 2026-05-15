import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getSessionToken } from "../lib/auth/session";

/**
 * Round 12 — landing route. Checks SecureStore for a persisted
 * session token and routes accordingly:
 *   - token present → `/(authed)` home (Task 6 will validate the
 *     token against the server; for now we trust SecureStore)
 *   - no token → `/(auth)/sign-in`
 *
 * Renders a centered spinner while the SecureStore read settles.
 * SecureStore is async and may take a frame; without the loading
 * state the screen would briefly flash empty.
 */
export default function Index() {
  const [routed, setRouted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function decide() {
      const token = await getSessionToken();
      if (cancelled) return;
      router.replace(token ? "/(authed)" : "/(auth)/sign-in");
      setRouted(true);
    }
    void decide();
    return () => {
      cancelled = true;
    };
  }, []);

  if (routed) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
