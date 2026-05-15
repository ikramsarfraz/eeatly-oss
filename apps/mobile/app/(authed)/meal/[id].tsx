import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { detectPlatform } from "@eeatly/shared";
import { formatCookedAt } from "../../../lib/dates";
import { trpc } from "../../../lib/trpc";
import { IngredientChecklist } from "../../../components/ingredient-checklist";
import { ShareSheet } from "../../../components/share-sheet";
import { SourceUrlEmbed } from "../../../components/embeds/source-url-embed";

function platformLabel(url: string): string | null {
  const detected = detectPlatform(url);
  if (!detected) return null;
  switch (detected.platform) {
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "pinterest":
      return "Pinterest";
    case "instagram":
      return "Instagram";
    case "web":
      return null;
  }
}

/**
 * Round 13 Task 5 — recipe view. Mobile-first single column the wife
 * pulls up at Meijer to see what to buy for biryani.
 *
 * Sections, top to bottom:
 *   - Hero photo (or placeholder block if missing)
 *   - Title + meta line (added by, cook count, last cooked)
 *   - Ingredients (read-only list this round; Task 6 makes them checkable
 *     and adds the shopping-list export)
 *   - Recipe text (pre-wrap preserves the AI-extracted line breaks)
 *   - Source link if present
 *   - Action row: Log again (one-tap re-cook) + Share (RN Share API)
 *
 * Data: `trpc.meals.getById.useQuery({ mealId })` — same procedure web
 * uses, household-scoped at the service.
 */

function lastCookedLabel(value: string | Date | null): string | null {
  if (!value) return null;
  const f = formatCookedAt(value);
  if (f === "today") return "Cooked today";
  if (f === "yesterday") return "Cooked yesterday";
  return `Last cooked ${f}`;
}

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = typeof id === "string" ? id : "";

  const query = trpc.meals.getById.useQuery(
    { mealId },
    {
      enabled: mealId.length > 0,
      staleTime: 30_000
    }
  );

  const meal = query.data;
  const title = meal?.name ?? "Meal";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title, headerBackTitle: "Back" }} />
      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2f6f58" />
        </View>
      ) : !meal ? (
        <MissingState />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Hero photoUrl={meal.photoUrl} name={meal.name} />
          <Header
            name={meal.name}
            cookCount={meal.cookCount}
            lastCookedAt={meal.lastCookedAt}
            createdByName={meal.createdByName}
          />
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Ingredients</Text>
            <IngredientChecklist
              ingredients={meal.ingredients}
              mealName={meal.name}
              mealId={meal.id}
              canExtract={Boolean(meal.recipeText?.trim())}
            />
          </View>
          <RecipeSection
            recipeText={meal.recipeText}
            recipeSourceUrl={meal.recipeSourceUrl}
          />
          <ActionRow
            mealId={meal.id}
            mealName={meal.name}
            recipeText={meal.recipeText}
            recipeSourceUrl={meal.recipeSourceUrl}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MissingState() {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={32} color="#888" />
      <Text style={styles.missingTitle}>Meal not found</Text>
      <Text style={styles.missingBody}>
        It may have been archived, or you don't have access in this household.
      </Text>
      <Pressable
        onPress={() => router.replace("/(authed)/home")}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>Back to home</Text>
      </Pressable>
    </View>
  );
}

function Hero({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={styles.hero}
        resizeMode="cover"
        accessibilityLabel={`Photo of ${name}`}
      />
    );
  }
  return (
    <View style={[styles.hero, styles.heroPlaceholder]} accessibilityElementsHidden>
      <Text style={styles.heroPlaceholderText}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function Header({
  name,
  cookCount,
  lastCookedAt,
  createdByName
}: {
  name: string;
  cookCount: number;
  lastCookedAt: string | Date | null;
  createdByName: string | null;
}) {
  const addedBy = createdByName ?? "Former member";
  const cookedText =
    cookCount === 0
      ? "Never cooked"
      : cookCount === 1
        ? "Cooked once"
        : `Cooked ${cookCount} times`;
  const cookedLabel = lastCookedLabel(lastCookedAt);
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{name}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Added by <Text style={styles.metaStrong}>{addedBy}</Text>
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{cookedText}</Text>
        {cookedLabel ? (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{cookedLabel}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

function RecipeSection({
  recipeText,
  recipeSourceUrl
}: {
  recipeText: string | null;
  recipeSourceUrl: string | null;
}) {
  const label = recipeSourceUrl ? platformLabel(recipeSourceUrl) : null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>Recipe</Text>
      {recipeText ? (
        <Text style={styles.recipeBody}>{recipeText}</Text>
      ) : (
        <Text style={styles.emptyText}>No recipe saved for this meal yet.</Text>
      )}
      {recipeSourceUrl ? (
        <View style={styles.embedWrap}>
          <SourceUrlEmbed url={recipeSourceUrl} />
          <Pressable
            onPress={() => Linking.openURL(recipeSourceUrl)}
            hitSlop={6}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.sourceLink}>
              View original on {label ?? "the source site"} →
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ActionRow({
  mealId,
  mealName,
  recipeText,
  recipeSourceUrl
}: {
  mealId: string;
  mealName: string;
  recipeText: string | null;
  recipeSourceUrl: string | null;
}) {
  const utils = trpc.useUtils();
  const [logState, setLogState] = useState<"idle" | "logged">("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  const logAgain = trpc.meals.createLog.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.dashboard.meals.invalidate(),
        utils.meals.getById.invalidate()
      ]);
      setLogState("logged");
      if (resetRef.current) clearTimeout(resetRef.current);
      resetRef.current = setTimeout(() => setLogState("idle"), 2400);
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      Alert.alert(
        "Couldn't log",
        reason === "RATE_LIMITED"
          ? "Slow down a moment — try again shortly."
          : error.message || "Try again."
      );
    }
  });

  function handleLogAgain() {
    if (logAgain.isPending || logState === "logged") return;
    logAgain.mutate({
      log: {
        mealName,
        effortLevel: "easy",
        cookedDate: formatYMD(new Date())
      },
      source: "log_again"
    });
  }

  const submitting = logAgain.isPending;
  const logged = logState === "logged";

  return (
    <View style={styles.actionRow}>
      <Pressable
        onPress={handleLogAgain}
        disabled={submitting || logged}
        style={({ pressed }) => [
          styles.actionButton,
          styles.actionPrimary,
          logged && styles.actionLogged,
          submitting && styles.actionDisabled,
          pressed && !submitting && !logged && styles.pressed
        ]}
        accessibilityRole="button"
        accessibilityLabel="Log this meal again for today"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons
              name={logged ? "checkmark-circle-outline" : "add-circle-outline"}
              size={18}
              color="#fff"
            />
            <Text style={styles.actionPrimaryText}>
              {logged ? "Logged for today" : "Log again"}
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => setShareOpen(true)}
        style={({ pressed }) => [
          styles.actionButton,
          styles.actionSecondary,
          pressed && styles.pressed
        ]}
        accessibilityRole="button"
        accessibilityLabel="Share this recipe"
      >
        <Ionicons name="share-outline" size={18} color="#2f6f58" />
        <Text style={styles.actionSecondaryText}>Share</Text>
      </Pressable>

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        mealId={mealId}
        mealName={mealName}
        recipeText={recipeText}
        recipeSourceUrl={recipeSourceUrl}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8
  },
  scroll: {
    paddingBottom: 40
  },
  hero: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#e8e6df"
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  heroPlaceholderText: {
    fontSize: 56,
    color: "#9b9b8e",
    fontWeight: "300"
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 6
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#111",
    lineHeight: 32
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 6,
    rowGap: 2
  },
  metaText: { fontSize: 12.5, color: "#666" },
  metaStrong: { color: "#222", fontWeight: "500" },
  metaDot: { fontSize: 12.5, color: "#aaa" },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  emptyText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic"
  },
  recipeBody: {
    fontSize: 15,
    color: "#222",
    lineHeight: 23
  },
  sourceLink: {
    fontSize: 13,
    color: "#2f6f58",
    marginTop: 6
  },
  embedWrap: {
    marginTop: 10,
    gap: 6
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 24
  },
  actionButton: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
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
  actionLogged: {
    backgroundColor: "#3d8a6f"
  },
  actionDisabled: {
    opacity: 0.85
  },
  actionPrimaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: "#cfd6cf",
    backgroundColor: "#fff"
  },
  actionSecondaryText: {
    color: "#2f6f58",
    fontSize: 15,
    fontWeight: "500"
  },
  pressed: { opacity: 0.85 },
  missingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
    marginTop: 4
  },
  missingBody: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 12
  },
  linkButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  linkText: {
    color: "#2f6f58",
    fontSize: 14,
    fontWeight: "500"
  }
});
