import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Round 13 Task 1 — placeholder. Library lists/searches the
 * household's meals via `trpc.search.meals` when a richer screen
 * lands. Phase-2 priority is dashboard → recipe view; library is
 * a stub for now so the tab is reachable + the meal-detail stack
 * has somewhere else to push from.
 */
export default function LibraryTab() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.center}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.body}>Search comes online with the rest of Phase 2.</Text>
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
