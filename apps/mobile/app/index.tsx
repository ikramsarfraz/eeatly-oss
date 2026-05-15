import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getSessionToken } from "../lib/auth/session";

/**
 * Round 12 / 13 — landing route. Checks SecureStore for a persisted
 * session token and routes accordingly:
 *   - token present → `/(authed)/home` (Round 13 added the tab-bar
 *     shell; explicitly target the home tab so the first frame is
 *     deterministic regardless of expo-router's tab-resolution rules)
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
      router.replace(token ? "/(authed)/home" : "/(auth)/sign-in");
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
