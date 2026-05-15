import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Round 13 Task 1 — placeholder. Task 3 ships the entry surface
 * (manual log + AI capture choices) here.
 */
export default function AddTab() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.center}>
        <Text style={styles.title}>Add</Text>
        <Text style={styles.body}>Logging + AI capture land in Tasks 3 + 4.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  body: { fontSize: 13, color: "#666" }
});
