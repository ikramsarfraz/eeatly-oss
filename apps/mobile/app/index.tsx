import { useEffect } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

/**
 * Round 12 — landing route. For Phase 1 this just bounces straight to
 * the sign-in screen; Task 5 will replace this with an auth-state
 * check that routes to `(authed)` when a session token already lives
 * in SecureStore.
 */
export default function Index() {
  useEffect(() => {
    router.replace("/(auth)/sign-in");
  }, []);

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
