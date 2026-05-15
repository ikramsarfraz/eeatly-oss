import { router } from "expo-router";
import { MealLogForm } from "../../../components/meal-log-form";
import { TopNav } from "../../../components/top-nav";
import { Screen } from "../../../components/ui";

/**
 * Round 18 — manual meal log entry. Editorial TopNav with Cancel/Save
 * affordances; the form itself is in `<MealLogForm>` (also used by
 * the AI review screen with `showRecipePreview`).
 */
export default function ManualLogScreen() {
  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Log a meal"
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        showSettings={false}
      />
      <MealLogForm submitSource="quick_log" />
    </Screen>
  );
}
