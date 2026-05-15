import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { clearSessionToken } from "../../lib/auth/session";

/**
 * Round 12 — placeholder authenticated home. The sign-out flow is live
 * (clears SecureStore + routes to sign-in). Task 6 replaces the body
 * with the "Hello, [name]" + tRPC health-ping evidence that everything
 * end-to-end works on a real device.
 */
export default function AuthedHome() {
  async function handleSignOut() {
    await clearSessionToken();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      <Text style={styles.body}>Task 6 wires the real screen here.</Text>
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "600"
  },
  body: {
    fontSize: 14,
    color: "#666"
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderColor: "#2f6f58",
    borderWidth: 1
  },
  buttonPressed: {
    backgroundColor: "#2f6f58",
    opacity: 0.9
  },
  buttonText: {
    color: "#2f6f58",
    fontSize: 14,
    fontWeight: "600"
  }
});
