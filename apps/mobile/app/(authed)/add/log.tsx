import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MealLogForm } from "../../../components/meal-log-form";

/**
 * Round 13 Task 3 — manual meal log entry. Thin wrapper around the
 * shared `<MealLogForm>` (Task 4's AI review screen uses the same
 * form with `showRecipePreview`).
 */
export default function ManualLogScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Log a meal", headerBackTitle: "Back" }} />
      <MealLogForm submitSource="quick_log" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" }
});
