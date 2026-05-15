import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Round 13 Task 1 — placeholder. Task 5 ships the real recipe view
 * (hero photo, ingredients checklist, recipe text, share + log-again
 * action row) here, using `trpc.meals.getById.useQuery({ mealId })`.
 */
export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.center}>
        <Text style={styles.title}>Meal</Text>
        <Text style={styles.body}>Recipe view lands in Task 5.</Text>
        <Text style={styles.body}>id: {id}</Text>
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
