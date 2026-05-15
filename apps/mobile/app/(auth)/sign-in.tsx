import { StyleSheet, Text, View } from "react-native";

/**
 * Round 12 — placeholder sign-in screen. Task 5 replaces this with the
 * magic-link request flow + deep-link verification.
 */
export default function SignIn() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>eeatly</Text>
      <Text style={styles.subtitle}>Sign-in lands here in Task 5.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 32,
    fontWeight: "600"
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#666"
  }
});
