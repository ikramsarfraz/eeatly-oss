import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Linking,
  ScrollView,
  Text,
  View
} from "react-native";
import { detectPlatform } from "@eeatly/shared";
import { formatCookedAt } from "../../../lib/dates";
import { colors } from "../../../lib/design/tokens";
import { trpc } from "../../../lib/trpc";
import { IngredientChecklist } from "../../../components/ingredient-checklist";
import { ShareSheet } from "../../../components/share-sheet";
import { SourceUrlEmbed } from "../../../components/embeds/source-url-embed";
import { TopNav } from "../../../components/top-nav";
import {
  Button,
  Chip,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  Screen,
  SectionLabel
} from "../../../components/ui";

/**
 * Round 18 recipe view — editorial rebuild.
 *
 * Top to bottom:
 *   - Editorial TopNav (back, no gear) — title shows meal name.
 *   - Full-bleed hero: 4:3 photo OR monogram tile at the same aspect.
 *   - Title block: serif name 36pt + meta row (caption) + optional
 *     source-platform chip.
 *   - Source URL embed (R16) if present.
 *   - "INGREDIENTS" section label + checklist.
 *   - "RECIPE" section label + prose.
 *   - Sticky-ish action row: forest "Log again" CTA + secondary Share.
 *
 * The wife's primary screen — every visual choice should make the
 * biryani recipe feel inviting, not like a database row.
 */

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

  if (query.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Meal" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!meal) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Meal" back showSettings={false} />
        <ErrorScreen
          title="Meal not found"
          body="It may have been archived, or you don't have access in this kitchen."
        />
        <View style={{ paddingHorizontal: 30, marginTop: -8, alignItems: "center" }}>
          <Button
            variant="secondary"
            onPress={() => router.replace("/(authed)/home")}
          >
            Back to home
          </Button>
        </View>
      </Screen>
    );
  }

  const sourcePlatform = meal.recipeSourceUrl
    ? platformLabel(meal.recipeSourceUrl)
    : null;

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav title={meal.name} back showSettings={false} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ width: "100%", aspectRatio: 4 / 3 }}>
          <MealTile
            name={meal.name}
            size="xl"
            photoUrl={meal.photoUrl}
            radius={0}
          />
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 22, gap: 10 }}>
          <Text
            className="font-display text-display-sm text-ink"
            style={{ letterSpacing: -0.4 }}
          >
            {meal.name}
          </Text>
          <MetaRow
            cookCount={meal.cookCount}
            lastCookedAt={meal.lastCookedAt}
            createdByName={meal.createdByName}
          />
          {sourcePlatform ? (
            <View style={{ flexDirection: "row", marginTop: 4 }}>
              <Chip tone="wheat">{`From ${sourcePlatform}`}</Chip>
            </View>
          ) : null}
        </View>

        {meal.recipeSourceUrl ? (
          <View style={{ paddingHorizontal: 22, paddingTop: 18, gap: 8 }}>
            <SourceUrlEmbed url={meal.recipeSourceUrl} />
            <SourceLink url={meal.recipeSourceUrl} label={sourcePlatform} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <SectionLabel>Ingredients</SectionLabel>
          <IngredientChecklist
            ingredients={meal.ingredients}
            mealName={meal.name}
            mealId={meal.id}
            canExtract={Boolean(meal.recipeText?.trim())}
          />
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <SectionLabel>Recipe</SectionLabel>
          {meal.recipeText ? (
            <Text
              className="font-body text-body-lg text-ink"
              style={{ lineHeight: 24 }}
            >
              {meal.recipeText}
            </Text>
          ) : (
            <Text className="font-display-italic text-body-lg text-ink-3">
              No recipe saved for this meal yet.
            </Text>
          )}
        </View>

        <ActionRow
          mealId={meal.id}
          mealName={meal.name}
          recipeText={meal.recipeText}
          recipeSourceUrl={meal.recipeSourceUrl}
        />
      </ScrollView>
    </Screen>
  );
}

function MetaRow({
  cookCount,
  lastCookedAt,
  createdByName
}: {
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
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      <Text className="font-body text-body-md text-ink-2">
        Added by{" "}
        <Text className="font-body-semibold text-ink">{addedBy}</Text>
      </Text>
      <Text className="font-body text-body-md text-ink-3">·</Text>
      <Text className="font-body text-body-md text-ink-2">{cookedText}</Text>
      {cookedLabel ? (
        <>
          <Text className="font-body text-body-md text-ink-3">·</Text>
          <Text className="font-body text-body-md text-ink-2">
            {cookedLabel}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function SourceLink({
  url,
  label
}: {
  url: string;
  label: string | null;
}) {
  return (
    <Text
      className="font-body-semibold text-body-sm text-forest"
      style={{ letterSpacing: -0.1 }}
      onPress={() => Linking.openURL(url)}
    >
      View original on {label ?? "the source site"} →
    </Text>
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
    <View
      style={{
        paddingHorizontal: 22,
        paddingTop: 28,
        flexDirection: "row",
        gap: 10
      }}
    >
      <View style={{ flex: 1 }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={logged}
          leadingIcon={
            <Ionicons
              name={logged ? "checkmark-circle-outline" : "add-circle-outline"}
              size={18}
              color={colors.forestText}
            />
          }
          onPress={handleLogAgain}
        >
          {logged ? "Logged for today" : "Log again"}
        </Button>
      </View>
      <Button
        variant="secondary"
        size="lg"
        leadingIcon={
          <Ionicons name="share-outline" size={18} color={colors.forest} />
        }
        onPress={() => setShareOpen(true)}
      >
        Share
      </Button>

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

