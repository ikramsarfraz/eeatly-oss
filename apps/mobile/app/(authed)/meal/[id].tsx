import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  Text,
  View
} from "react-native";
import { detectPlatform } from "@eeatly/shared";
import { formatCookedAt } from "../../../lib/dates";
import { trpc } from "../../../lib/trpc";
import { IngredientChecklist } from "../../../components/ingredient-checklist";
import { ShareSheet } from "../../../components/share-sheet";
import { SourceUrlEmbed } from "../../../components/embeds/source-url-embed";
import {
  Button,
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionHeader,
  Tag
} from "../../../components/ui";

/**
 * Round 17 recipe view — NativeWind rebuild of the R13 screen.
 *
 * Layout, top to bottom:
 *   - Full-bleed hero (40% screen height aspect) — photo or
 *     placeholder card with food icon
 *   - Title + meta row (caption, foreground-muted) + optional
 *     source-platform tag
 *   - Embed (R16) if `recipeSourceUrl` is set
 *   - Ingredients checklist
 *   - Recipe body (prose, 24px line-height)
 *   - Sticky action row at bottom: Log again + Share
 *
 * The wife's primary screen — every visual choice in here should
 * make the biryani recipe feel inviting, not like a database row.
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
  const title = meal?.name ?? "Meal";

  if (query.isPending) {
    return (
      <>
        <Stack.Screen
          options={{
            title,
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <LoadingScreen />
      </>
    );
  }

  if (!meal) {
    return (
      <>
        <Stack.Screen options={{ title: "Meal", headerBackTitle: "Back" }} />
        <View className="flex-1 bg-background">
          <ErrorScreen
            title="Meal not found"
            body="It may have been archived, or you don't have access in this household."
          />
          <View className="px-8 pb-12 -mt-4 items-center">
            <Button
              variant="secondary"
              onPress={() => router.replace("/(authed)/home")}
            >
              Back to home
            </Button>
          </View>
        </View>
      </>
    );
  }

  const sourcePlatform = meal.recipeSourceUrl
    ? platformLabel(meal.recipeSourceUrl)
    : null;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title,
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FBF8F1" },
          headerTintColor: "#1A1F1B",
          headerTitleStyle: { fontWeight: "600" }
        }}
      />
      <ScrollView contentContainerClassName="pb-12">
        <Hero photoUrl={meal.photoUrl} name={meal.name} />
        <Header
          name={meal.name}
          cookCount={meal.cookCount}
          lastCookedAt={meal.lastCookedAt}
          createdByName={meal.createdByName}
          sourcePlatform={sourcePlatform}
        />

        {meal.recipeSourceUrl ? (
          <View className="px-4 pt-4 gap-2">
            <SourceUrlEmbed url={meal.recipeSourceUrl} />
            <SourceLink
              url={meal.recipeSourceUrl}
              label={sourcePlatform}
            />
          </View>
        ) : null}

        <View className="mt-2">
          <SectionHeader title="Ingredients" />
          <View className="px-4">
            <IngredientChecklist
              ingredients={meal.ingredients}
              mealName={meal.name}
              mealId={meal.id}
              canExtract={Boolean(meal.recipeText?.trim())}
            />
          </View>
        </View>

        <View>
          <SectionHeader title="Recipe" />
          <View className="px-4">
            {meal.recipeText ? (
              <Text className="text-body text-foreground leading-6">
                {meal.recipeText}
              </Text>
            ) : (
              <Text className="text-body italic text-foreground-muted">
                No recipe saved for this meal yet.
              </Text>
            )}
          </View>
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

function Hero({
  photoUrl,
  name
}: {
  photoUrl: string | null;
  name: string;
}) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        className="w-full bg-background-muted aspect-[4/3]"
        resizeMode="cover"
        accessibilityLabel={`Photo of ${name}`}
      />
    );
  }
  return (
    <View
      className="w-full aspect-[4/3] items-center justify-center bg-primary-muted"
      accessibilityElementsHidden
    >
      <Ionicons name="restaurant-outline" size={56} color="#2C5F3F" />
    </View>
  );
}

function Header({
  name,
  cookCount,
  lastCookedAt,
  createdByName,
  sourcePlatform
}: {
  name: string;
  cookCount: number;
  lastCookedAt: string | Date | null;
  createdByName: string | null;
  sourcePlatform: string | null;
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
    <View className="px-4 pt-4 gap-2">
      <Text className="text-heading-1 font-bold text-foreground">{name}</Text>
      <View className="flex-row items-center flex-wrap gap-x-1.5 gap-y-1">
        <Text className="text-caption text-foreground-muted">
          Added by{" "}
          <Text className="text-foreground font-semibold">{addedBy}</Text>
        </Text>
        <Text className="text-caption text-foreground-subtle">·</Text>
        <Text className="text-caption text-foreground-muted">{cookedText}</Text>
        {cookedLabel ? (
          <>
            <Text className="text-caption text-foreground-subtle">·</Text>
            <Text className="text-caption text-foreground-muted">
              {cookedLabel}
            </Text>
          </>
        ) : null}
      </View>
      {sourcePlatform ? (
        <View className="flex-row mt-1">
          <Tag variant="accent">{`From ${sourcePlatform}`}</Tag>
        </View>
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
      className="text-caption-strong font-semibold text-primary"
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
    <View className="px-4 pt-6 flex-row gap-2">
      <View className="flex-1">
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
              color="#FBF8F1"
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
          <Ionicons name="share-outline" size={18} color="#2C5F3F" />
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
