import { StyleSheet, Text, View } from "react-native";

/**
 * Round 12 — placeholder authenticated home. Task 6 replaces this with
 * the real "Hello, [name]" + tRPC health-ping screen that proves the
 * full mobile stack works on a real device.
 */
export default function AuthedHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to eeatly</Text>
      <Text style={styles.subtitle}>Task 6 wires the real screen here.</Text>
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
    fontSize: 24,
    fontWeight: "600"
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#666"
  }
});
