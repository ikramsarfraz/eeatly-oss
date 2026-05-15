import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { trpc } from "../lib/trpc";

/**
 * Round 13 Task 6 — interactive ingredient list + shopping list export.
 *
 * UX:
 *   - Each row taps to toggle "got it" (strikethrough + dimmed). State
 *     is local-only and resets when the component remounts (fresh
 *     shopping trip each open). No backend persistence — keeping it
 *     out of the household's shared state is intentional: two cooks
 *     shopping in different aisles shouldn't see each other's checks.
 *   - Header shows "N still need" so the user knows how much is left.
 *   - "Share shopping list" sends a formatted text via the platform
 *     share sheet (Messages/WhatsApp/etc) of the UN-checked items.
 *     "Copy" uses expo-clipboard for fast paste-into-Notes.
 *   - Empty + recipeText → "Extract ingredients" CTA which calls
 *     `ai.extractIngredientsForMeal` (Plus-gated, mirrors web).
 *   - Empty + no recipeText → quiet "no ingredients" message; can't
 *     extract from nothing, so we don't offer.
 */

export type IngredientChecklistProps = {
  ingredients: string[] | null;
  mealName: string;
  mealId: string;
  /** True if the meal has saved recipeText (precondition for AI extraction). */
  canExtract: boolean;
};

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

function buildShoppingListText(mealName: string, items: string[]): string {
  const header = `Shopping list — ${mealName}`;
  const body = items.map((line) => `• ${line}`).join("\n");
  return `${header}\n\n${body}`;
}

export function IngredientChecklist({
  ingredients,
  mealName,
  mealId,
  canExtract
}: IngredientChecklistProps) {
  const utils = trpc.useUtils();
  const items = ingredients ?? [];
  const [checked, setChecked] = useState<boolean[]>(() =>
    items.map(() => false)
  );

  // Keep the checked-mask in sync if the ingredients array changes
  // length (e.g. after the AI extract mutation lands new items). Resets
  // all checks — by design: a re-extract is a "start over" signal.
  useEffect(() => {
    setChecked((prev) =>
      prev.length === items.length ? prev : items.map(() => false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const extract = trpc.ai.extractIngredientsForMeal.useMutation({
    onSuccess: async () => {
      // Refresh the meal detail so the new ingredients render via the
      // parent's `getById` query without a manual page reload.
      await utils.meals.getById.invalidate();
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      if (reason === "UPGRADE_REQUIRED") {
        Alert.alert(
          "Plus feature",
          "Extracting ingredients with AI is a Plus feature. Upgrade on the web.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "See Plus",
              onPress: () => Linking.openURL("https://eeatly.app/pricing")
            }
          ]
        );
        return;
      }
      const message =
        reason === "RATE_LIMITED"
          ? "Try again in a moment."
          : reason === "NO_RECIPE_TEXT"
            ? "There's no recipe text to extract from. Add a recipe first."
            : reason === "NOT_FOUND"
              ? "This meal isn't accessible."
              : error.message || "Couldn't extract ingredients.";
      Alert.alert("AI couldn't help", message);
    }
  });

  // -------- Empty states ----------------------------------------------

  if (items.length === 0) {
    if (canExtract) {
      return (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyText}>
            No ingredients saved yet. We can read them from the recipe text.
          </Text>
          <Pressable
            onPress={() => extract.mutate({ mealId })}
            disabled={extract.isPending}
            style={({ pressed }) => [
              styles.extractButton,
              extract.isPending && styles.disabled,
              pressed && !extract.isPending && styles.pressed
            ]}
            accessibilityRole="button"
          >
            {extract.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={16} color="#fff" />
                <Text style={styles.extractButtonText}>Extract ingredients</Text>
              </>
            )}
          </Pressable>
        </View>
      );
    }
    return (
      <Text style={styles.emptyText}>
        No ingredients saved yet. Edit on the web to add them.
      </Text>
    );
  }

  // -------- Active list ------------------------------------------------

  const remaining = items.filter((_, i) => !checked[i]);
  const remainingCount = remaining.length;
  const allDone = remainingCount === 0;
  const anyChecked = checked.some(Boolean);

  function toggle(index: number) {
    setChecked((prev) => {
      const next = prev.slice();
      next[index] = !next[index];
      return next;
    });
  }

  function resetAll() {
    setChecked(items.map(() => false));
  }

  async function shareList() {
    if (remainingCount === 0) {
      Alert.alert("Nothing to send", "You've got everything checked off.");
      return;
    }
    try {
      await Share.share({
        title: `Shopping list — ${mealName}`,
        message: buildShoppingListText(mealName, remaining)
      });
    } catch {
      /* user cancelled */
    }
  }

  async function copyList() {
    if (remainingCount === 0) {
      Alert.alert("Nothing to copy", "You've got everything checked off.");
      return;
    }
    await Clipboard.setStringAsync(buildShoppingListText(mealName, remaining));
    Alert.alert(
      "Copied",
      `${remainingCount} item${remainingCount === 1 ? "" : "s"} copied to clipboard.`
    );
  }

  return (
    <View style={styles.checklistWrap}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {allDone
            ? "All set — nothing left."
            : `${remainingCount} of ${items.length} still need`}
        </Text>
        {anyChecked ? (
          <Pressable
            onPress={resetAll}
            hitSlop={6}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.resetLink}>Clear checks</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.list}>
        {items.map((line, i) => {
          const done = !!checked[i];
          return (
            <Pressable
              key={`${line}-${i}`}
              onPress={() => toggle(i)}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={line}
            >
              <Ionicons
                name={done ? "checkbox-outline" : "square-outline"}
                size={22}
                color={done ? "#2f6f58" : "#888"}
              />
              <Text style={[styles.lineText, done && styles.lineDone]}>
                {line}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={shareList}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionPrimary,
            pressed && styles.pressed
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.actionPrimaryText}>Share shopping list</Text>
        </Pressable>
        <Pressable
          onPress={copyList}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionSecondary,
            pressed && styles.pressed
          ]}
          accessibilityRole="button"
          accessibilityLabel="Copy shopping list to clipboard"
        >
          <Ionicons name="copy-outline" size={18} color="#2f6f58" />
          <Text style={styles.actionSecondaryText}>Copy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  checklistWrap: { gap: 10 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 2
  },
  statusText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500"
  },
  resetLink: {
    fontSize: 13,
    color: "#2f6f58",
    fontWeight: "500"
  },
  list: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    backgroundColor: "#fff",
    marginHorizontal: -20,
    paddingHorizontal: 20
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    minHeight: 44
  },
  rowPressed: {
    backgroundColor: "#f3f1ea"
  },
  lineText: {
    flex: 1,
    fontSize: 15,
    color: "#222",
    lineHeight: 21
  },
  lineDone: {
    color: "#999",
    textDecorationLine: "line-through"
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  actionButton: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: "#2f6f58"
  },
  actionPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: "#cfd6cf",
    backgroundColor: "#fff"
  },
  actionSecondaryText: {
    color: "#2f6f58",
    fontSize: 14,
    fontWeight: "500"
  },
  emptyBlock: {
    gap: 12
  },
  emptyText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic"
  },
  extractButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#2f6f58",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  extractButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.7 }
});
