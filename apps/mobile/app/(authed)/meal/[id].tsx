import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View
} from "react-native";
import { detectPlatform } from "@eeatly/shared";
import { formatCookedAt } from "../../../lib/dates";
import { colors } from "../../../lib/design/tokens";
import { trpc } from "../../../lib/trpc";
import { ShareSheet } from "../../../components/share-sheet";
import { SourceUrlEmbed } from "../../../components/embeds/source-url-embed";
import { TopNav } from "../../../components/top-nav";
import {
  Button,
  Card,
  Chip,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  Screen,
  SectionLabel
} from "../../../components/ui";

/**
 * Round 18 recipe view — editorial rebuild matching the recipe-detail
 * handoff.
 *
 * Stack:
 *   - TopNav (Recipe, back chevron, pencil edit) — title is a literal
 *     "Recipe" word per handoff, not the dish name.
 *   - Hero tile: 230pt monogram (or photo), 14px radius, inset.
 *   - Editorial two-line title: italic kicker ("Chowmein,") + serif
 *     main word ("Noodles."). Single-word titles drop the kicker.
 *   - Mono meta: "Added by alex.rivers · 1 cook · 4 days ago"
 *   - Chip row: ghost ingredients-count + wheat steps-count + sage
 *     source-platform (when present).
 *   - Optional source-URL embed (R16).
 *   - Ingredients section: card with checkbox rows; right-aligned
 *     mono "N of M to buy" counter; bought state local-only.
 *   - Share + Copy buttons (sage filled + outline).
 *   - Recipe steps: cards with italic forest numeral + serif title +
 *     wrap-row of ingredient pills (parsed from recipe text).
 *   - Bottom forest CTA: "Log a cook".
 */

type Step = { number: number; title: string; ingredients: string[] };

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

/**
 * Split a dish name into editorial overline + main word per handoff
 * guidance: "pick a comma break or a natural pause. For single-word
 * titles, the overline can be omitted." For two-or-more-word names we
 * peel off the last word as the main, append a period, and put the rest
 * (comma-suffixed) as the italic overline. Falls through to a single
 * line for single-word names.
 */
function splitTitle(name: string): { kicker: string | null; main: string } {
  const trimmed = name.trim();
  if (!trimmed) return { kicker: null, main: "." };
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    return { kicker: null, main: `${trimmed}.` };
  }
  const main = `${parts[parts.length - 1]}.`;
  const kicker = `${parts.slice(0, -1).join(" ")},`;
  return { kicker, main };
}

/**
 * Parse recipe-text prose into structured steps. Recognises three
 * patterns in priority order:
 *   1. Explicit numbered lines (`1.`, `2)`, `Step 1:`)
 *   2. Blank-line separated paragraphs (each = one step)
 *   3. Falls back to a single step containing the whole text
 *
 * Step titles try to lift the first short line/sentence; the rest is
 * implicit. Per-step ingredients are inferred by matching the meal's
 * ingredient list against the step body (case-insensitive substring).
 */
function parseSteps(recipeText: string, ingredients: string[]): Step[] {
  const text = recipeText.trim();
  if (!text) return [];

  let blocks: string[] = [];
  const numbered = text.match(/(?:^|\n)\s*(?:\d+[.)]|Step\s+\d+[:.])/gi);
  if (numbered && numbered.length >= 2) {
    blocks = text
      .split(/(?:^|\n)\s*(?:\d+[.)]|Step\s+\d+[:.])\s*/i)
      .map((b) => b.trim())
      .filter(Boolean);
  } else {
    blocks = text
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
  }

  if (blocks.length === 0) blocks = [text];

  return blocks.map((block, i) => {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    // Prefer the first short clause as the step title (up to first `.` or `,`).
    const titleMatch = firstLine.match(/^(.{0,60}?)(?:[.,;]|$)/);
    const titleRaw = (titleMatch?.[1] ?? firstLine).trim();
    const title = titleRaw.length > 0 ? titleRaw : `Step ${i + 1}`;
    const used = ingredients.filter((ing) => {
      const needle = ing.trim().toLowerCase();
      if (!needle) return false;
      return block.toLowerCase().includes(needle);
    });
    return {
      number: i + 1,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      ingredients: used
    };
  });
}

function buildShoppingListText(mealName: string, items: string[]): string {
  const header = `Shopping list — ${mealName}`;
  const body = items.map((line) => `• ${line}`).join("\n");
  return `${header}\n\n${body}`;
}

function cookCountLabel(n: number): string {
  if (n === 0) return "Never cooked";
  if (n === 1) return "1 cook";
  return `${n} cooks`;
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
        <TopNav title="Recipe" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!meal) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Recipe" back showSettings={false} />
        <ErrorScreen
          title="Recipe not found"
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

  return <MealDetailBody meal={meal} />;
}

function MealDetailBody({
  meal
}: {
  meal: {
    id: string;
    name: string;
    photoUrl: string | null;
    recipeText: string | null;
    recipeSourceUrl: string | null;
    ingredients: string[] | null;
    cookCount: number;
    lastCookedAt: string | Date | null;
    createdByName: string | null;
  };
}) {
  const ingredients = meal.ingredients ?? [];
  const steps = useMemo(
    () => (meal.recipeText ? parseSteps(meal.recipeText, ingredients) : []),
    [meal.recipeText, ingredients]
  );

  const sourcePlatform = meal.recipeSourceUrl
    ? platformLabel(meal.recipeSourceUrl)
    : null;

  const { kicker, main } = splitTitle(meal.name);
  const meta = buildMetaLine({
    createdByName: meal.createdByName,
    cookCount: meal.cookCount,
    lastCookedAt: meal.lastCookedAt
  });

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Recipe"
        back
        showSettings={false}
        right={
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Edit recipe"
            onPress={() =>
              Alert.alert(
                "Edit recipe",
                "Recipe editing lives on the web for now — open eeatly.app to make changes."
              )
            }
          >
            <Ionicons name="create-outline" size={22} color={colors.forest} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <View
          style={{
            height: 230,
            marginTop: 6,
            marginBottom: 20,
            borderRadius: 14,
            overflow: "hidden"
          }}
        >
          <MealTile
            name={meal.name}
            size="xl"
            photoUrl={meal.photoUrl}
            radius={14}
          />
        </View>

        <View style={{ marginBottom: 14 }}>
          {kicker ? (
            <Text
              style={{
                fontFamily: "InstrumentSerif_400Regular_Italic",
                fontSize: 18,
                color: colors.ink2,
                marginBottom: 2,
                letterSpacing: 0.1
              }}
            >
              {kicker}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: "InstrumentSerif_400Regular",
              fontSize: 46,
              lineHeight: 46 * 0.98,
              color: colors.ink,
              letterSpacing: -0.92,
              marginBottom: 12
            }}
          >
            {main}
          </Text>
          <Text
            className="font-mono text-label text-ink-3 uppercase"
            style={{ letterSpacing: 1.3 }}
            numberOfLines={2}
          >
            {meta}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 26
          }}
        >
          <Chip tone="ghost">{`${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"}`}</Chip>
          {steps.length > 0 ? (
            <Chip tone="wheat">{`${steps.length} step${steps.length === 1 ? "" : "s"}`}</Chip>
          ) : null}
          {sourcePlatform ? (
            <Chip tone="sage">{`From ${sourcePlatform}`}</Chip>
          ) : null}
        </View>

        {meal.recipeSourceUrl ? (
          <View style={{ marginBottom: 22, gap: 8 }}>
            <SourceUrlEmbed url={meal.recipeSourceUrl} />
            <SourceLink url={meal.recipeSourceUrl} label={sourcePlatform} />
          </View>
        ) : null}

        <IngredientsSection
          mealId={meal.id}
          mealName={meal.name}
          ingredients={ingredients}
          canExtract={Boolean(meal.recipeText?.trim())}
        />

        {steps.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <SectionLabel>Recipe</SectionLabel>
            <View style={{ gap: 14 }}>
              {steps.map((step) => (
                <StepCard key={step.number} step={step} />
              ))}
            </View>
          </View>
        ) : meal.recipeText ? (
          <View style={{ marginBottom: 18 }}>
            <SectionLabel>Recipe</SectionLabel>
            <Card>
              <View style={{ padding: 18 }}>
                <Text
                  className="font-body text-body-lg text-ink"
                  style={{ lineHeight: 24 }}
                >
                  {meal.recipeText}
                </Text>
              </View>
            </Card>
          </View>
        ) : (
          <View style={{ marginBottom: 18 }}>
            <SectionLabel>Recipe</SectionLabel>
            <Text className="font-display-italic text-body-lg text-ink-3">
              No recipe saved for this dish yet.
            </Text>
          </View>
        )}

        <LogACookCta
          mealId={meal.id}
          mealName={meal.name}
          recipeText={meal.recipeText}
          recipeSourceUrl={meal.recipeSourceUrl}
        />
      </ScrollView>
    </Screen>
  );
}

function buildMetaLine({
  createdByName,
  cookCount,
  lastCookedAt
}: {
  createdByName: string | null;
  cookCount: number;
  lastCookedAt: string | Date | null;
}): string {
  const addedBy = createdByName ?? "Former member";
  const cookLabel = cookCountLabel(cookCount);
  const cookedAt = lastCookedAt ? formatCookedAt(lastCookedAt) : null;
  const parts = [`Added by ${addedBy}`, cookLabel];
  if (cookedAt) parts.push(cookedAt);
  return parts.join(" · ");
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

/* ─── Ingredients (checklist + share/copy) ──────────────────────── */

function IngredientsSection({
  mealId,
  mealName,
  ingredients,
  canExtract
}: {
  mealId: string;
  mealName: string;
  ingredients: string[];
  canExtract: boolean;
}) {
  const utils = trpc.useUtils();
  const [checked, setChecked] = useState<boolean[]>(() =>
    ingredients.map(() => false)
  );

  useEffect(() => {
    setChecked((prev) =>
      prev.length === ingredients.length
        ? prev
        : ingredients.map(() => false)
    );
  }, [ingredients.length]);

  const extract = trpc.ai.extractIngredientsForMeal.useMutation({
    onSuccess: async () => {
      await utils.meals.getById.invalidate();
    },
    onError: (error: unknown) => {
      const reason = getCauseReason(error);
      const message =
        reason === "UPGRADE_REQUIRED"
          ? "Extracting ingredients with AI is a Plus feature. Upgrade on the web."
          : reason === "RATE_LIMITED"
            ? "Try again in a moment."
            : reason === "NO_RECIPE_TEXT"
              ? "There's no recipe text to extract from. Add a recipe first."
              : (error as { message?: string }).message ??
                "Couldn't extract ingredients.";
      Alert.alert("AI couldn't help", message);
    }
  });

  if (ingredients.length === 0) {
    return (
      <View style={{ marginBottom: 30 }}>
        <SectionLabel>Ingredients</SectionLabel>
        {canExtract ? (
          <View style={{ gap: 10 }}>
            <Text className="font-display-italic text-body-lg text-ink-3">
              No ingredients saved yet. AI can read them from the recipe.
            </Text>
            <Button
              variant="secondary"
              size="md"
              loading={extract.isPending}
              disabled={extract.isPending}
              leadingIcon={
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={colors.forest}
                />
              }
              onPress={() => extract.mutate({ mealId })}
            >
              Extract ingredients
            </Button>
          </View>
        ) : (
          <Text className="font-display-italic text-body-lg text-ink-3">
            No ingredients saved yet. Edit on the web to add them.
          </Text>
        )}
      </View>
    );
  }

  const remaining = ingredients.filter((_, i) => !checked[i]);
  const remainingCount = remaining.length;

  function toggle(index: number) {
    setChecked((prev) => {
      const next = prev.slice();
      next[index] = !next[index];
      return next;
    });
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
    <View style={{ marginBottom: 30 }}>
      <SectionLabel
        action={
          <Text
            className="font-mono text-eyebrow text-ink-3 uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {`${remainingCount} of ${ingredients.length} to buy`}
          </Text>
        }
      >
        Ingredients
      </SectionLabel>

      <Card style={{ marginBottom: 14, overflow: "hidden" }}>
        {ingredients.map((ing, i) => (
          <IngredientRow
            key={`${ing}-${i}`}
            label={ing}
            checked={!!checked[i]}
            isFirst={i === 0}
            onToggle={() => toggle(i)}
          />
        ))}
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={shareList}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 99,
            backgroundColor: colors.sageBg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}
          accessibilityRole="button"
          accessibilityLabel="Share shopping list"
          className="active:opacity-80"
        >
          <Ionicons name="share-outline" size={16} color={colors.forest} />
          <Text
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: 13.5,
              color: colors.forest,
              letterSpacing: -0.1
            }}
          >
            Share shopping list
          </Text>
        </Pressable>
        <Pressable
          onPress={copyList}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 99,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "transparent",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}
          accessibilityRole="button"
          accessibilityLabel="Copy shopping list to clipboard"
          className="active:opacity-70"
        >
          <Ionicons name="copy-outline" size={16} color={colors.ink} />
          <Text
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: 13.5,
              color: colors.ink,
              letterSpacing: -0.1
            }}
          >
            Copy
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function IngredientRow({
  label,
  checked,
  isFirst,
  onToggle
}: {
  label: string;
  checked: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.borderSoft
      }}
      className="active:bg-sage-bg/40"
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? colors.forest : colors.ink4,
          backgroundColor: checked ? colors.forest : "transparent",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {checked ? (
          <Ionicons name="checkmark" size={14} color={colors.forestText} />
        ) : null}
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: "Geist_500Medium",
          fontSize: 14.5,
          color: checked ? colors.ink3 : colors.ink,
          letterSpacing: -0.1,
          textDecorationLine: checked ? "line-through" : "none",
          textDecorationColor: colors.ink4
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Step card ─────────────────────────────────────────────────── */

function StepCard({ step }: { step: Step }) {
  return (
    <Card>
      <View style={{ padding: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 12,
            marginBottom: step.ingredients.length > 0 ? 12 : 0
          }}
        >
          <Text
            style={{
              fontFamily: "InstrumentSerif_400Regular_Italic",
              fontSize: 32,
              lineHeight: 32,
              color: colors.forest,
              letterSpacing: -0.64,
              minWidth: 24
            }}
          >
            {step.number}.
          </Text>
          <Text
            style={{
              flex: 1,
              fontFamily: "InstrumentSerif_400Regular",
              fontSize: 22,
              lineHeight: 22 * 1.05,
              color: colors.ink,
              letterSpacing: -0.44
            }}
          >
            {step.title}
          </Text>
        </View>
        {step.ingredients.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6
            }}
          >
            {step.ingredients.map((it) => (
              <View
                key={it}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 99,
                  backgroundColor: colors.cream,
                  borderWidth: 1,
                  borderColor: colors.borderSoft
                }}
              >
                <Text
                  style={{
                    fontFamily: "Geist_500Medium",
                    fontSize: 12.5,
                    color: colors.ink2,
                    letterSpacing: -0.05
                  }}
                >
                  {it}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/* ─── Bottom Log-a-cook CTA + Share sheet ───────────────────────── */

function LogACookCta({
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
    onError: (error: unknown) => {
      const reason = getCauseReason(error);
      Alert.alert(
        "Couldn't log",
        reason === "RATE_LIMITED"
          ? "Slow down a moment — try again shortly."
          : (error as { message?: string }).message ?? "Try again."
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
    <View style={{ gap: 12 }}>
      <Pressable
        onPress={handleLogAgain}
        disabled={submitting || logged}
        accessibilityRole="button"
        accessibilityLabel={logged ? "Logged for today" : "Log a cook"}
        style={{
          width: "100%",
          paddingVertical: 16,
          paddingHorizontal: 22,
          borderRadius: 99,
          backgroundColor: colors.forest,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: submitting || logged ? 0.85 : 1,
          shadowColor: colors.forest,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 20,
          elevation: 4
        }}
        className="active:opacity-90"
      >
        <Ionicons
          name={
            logged
              ? "checkmark-circle-outline"
              : submitting
                ? "time-outline"
                : "restaurant-outline"
          }
          size={20}
          color={colors.forestText}
        />
        <Text
          style={{
            fontFamily: "Geist_600SemiBold",
            fontSize: 15.5,
            color: colors.forestText,
            letterSpacing: -0.1
          }}
        >
          {logged ? "Logged for today" : submitting ? "Logging…" : "Log a cook"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setShareOpen(true)}
        style={{
          alignSelf: "center",
          paddingVertical: 8,
          paddingHorizontal: 16
        }}
        accessibilityRole="button"
        accessibilityLabel="Share recipe"
      >
        <Text
          style={{
            fontFamily: "Geist_600SemiBold",
            fontSize: 13.5,
            color: colors.forest,
            letterSpacing: -0.1
          }}
        >
          Share recipe →
        </Text>
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
