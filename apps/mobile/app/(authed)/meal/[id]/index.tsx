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
import { formatCookedAt } from "../../../../lib/dates";
import { useThemeColors } from "../../../../lib/design/use-theme-colors";
import { trpc } from "../../../../lib/trpc";
import { ShareSheet } from "../../../../components/share-sheet";
import { SourceUrlEmbed } from "../../../../components/embeds/source-url-embed";
import { TopNav } from "../../../../components/top-nav";
import {
  Button,
  Card,
  Chip,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  Screen,
  SectionLabel
} from "../../../../components/ui";

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

type Step = {
  number: number;
  title: string;
  /** Free-form time string, rendered as-is in mono caps (e.g. "10 min · then 20 min rest"). */
  time: string | null;
  /** Instruction paragraph rendered under the title. Empty when the
   *  step's block is just the title with no follow-on text. */
  body: string;
  ingredients: string[];
};

/** Parsed ingredient line — name + optional quantity + optional prep note. */
type ParsedIngredient = {
  /** Display label for the ingredient name. */
  name: string;
  /** Free-form quantity string (e.g. "400 g", "1 tsp", "2 cups"). `null` when
   *  the source string has no detectable quantity. */
  qty: string | null;
  /** Optional prep note (e.g. "julienned", "boneless, sliced"). */
  note: string | null;
};

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
 * For each block we try to lift:
 *   - title — first short clause (up to a punctuation break)
 *   - time  — a `(10 min)` parenthetical or trailing `· 10 min` on the
 *             title line; captured verbatim and rendered in mono caps
 *   - body  — the prose after the title, joined back into a single
 *             paragraph for readable rendering
 *
 * Per-step ingredients are inferred by matching the meal's ingredient
 * list against the block body (case-insensitive substring on each
 * stored name; rough but workable until we ship structured steps).
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

    // Pull a parenthetical time off the title line ("Marinate the chicken (10 min)").
    let titleSource = firstLine;
    let time: string | null = null;
    const parenTime = firstLine.match(
      /\s*[(\[]\s*((?:~?\d[\d\s./·–—-]*(?:min|minute|minutes|hr|hour|hours|sec|s)(?:[^)\]]*)?))[)\]]\s*$/i
    );
    if (parenTime) {
      time = parenTime[1].trim();
      titleSource = firstLine.slice(0, parenTime.index).trim();
    } else {
      // Trailing " — 10 min" or " · 10 min" after the title.
      const trailingTime = firstLine.match(
        /^(.*?)\s*[·\-–—]\s*(~?\d[\d\s./·–—-]*(?:min|minute|minutes|hr|hour|hours|sec|s)(?:.*)?)$/i
      );
      if (trailingTime) {
        titleSource = trailingTime[1].trim();
        time = trailingTime[2].trim();
      }
    }

    // First short clause becomes the title; the rest of the line + any
    // following lines fold into the body.
    const titleMatch = titleSource.match(/^(.{0,60}?)(?:[.;]|$)/);
    const titleRaw = (titleMatch?.[1] ?? titleSource).trim();
    const title = titleRaw.length > 0 ? titleRaw : `Step ${i + 1}`;

    // Body = everything after the title clause + any subsequent lines.
    const remainderOfFirstLine = titleSource.slice(titleRaw.length).trim();
    const trimmedRemainder = remainderOfFirstLine.replace(/^[.;,\s]+/, "").trim();
    const followOnLines = lines.slice(1).join(" ").trim();
    const body = [trimmedRemainder, followOnLines]
      .filter(Boolean)
      .join(" ")
      .trim();

    const used = ingredients
      .map(parseIngredientLine)
      .filter((ing) => {
        const needle = ing.name.trim().toLowerCase();
        if (!needle) return false;
        return block.toLowerCase().includes(needle);
      })
      .map((ing) => ing.name);

    return {
      number: i + 1,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      time,
      body,
      ingredients: used
    };
  });
}

const FRACTION_RE = "[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]";
const UNIT_WORDS =
  "g|kg|mg|ml|l|tsp|tbsp|cup|cups|oz|lb|lbs|pinch|pinches|piece|pieces|small|medium|large|cloves?|slices?|sprigs?|cans?|sticks?";
const QTY_HEAD_RE = new RegExp(
  `^((?:\\d+(?:\\s*${FRACTION_RE})?|${FRACTION_RE})` +
    `(?:\\s*[-–—/]\\s*\\d+(?:\\s*${FRACTION_RE})?)?` +
    `(?:\\s*(?:${UNIT_WORDS}))?)` +
    `\\b\\s+(.+)$`,
  "i"
);
const QTY_TAIL_RE = new RegExp(
  `^(.+?)\\s*[\\-–—,:]\\s*` +
    `((?:\\d+(?:\\s*${FRACTION_RE})?|${FRACTION_RE})` +
    `(?:\\s*[-–—/]\\s*\\d+(?:\\s*${FRACTION_RE})?)?` +
    `(?:\\s*(?:${UNIT_WORDS}))?)\\s*$`,
  "i"
);

/**
 * Best-effort split of a stored ingredient string into name + qty + note.
 *
 * Recognises three common shapes:
 *   1. Leading qty: "400 g chicken" → qty="400 g", name="chicken"
 *   2. Trailing qty:  "Salt — 1 tsp" or "Salt, 1 tsp" → qty="1 tsp", name="Salt"
 *   3. Parenthetical or trailing-comma note: "Carrot (julienned)" or
 *      "Carrot, julienned" → name="Carrot", note="julienned"
 *
 * Quantity strings are returned verbatim so the user's chosen unit
 * survives unchanged. Names are title-cased on the first character so
 * a downstream renderer doesn't have to.
 */
function parseIngredientLine(raw: string): ParsedIngredient {
  const initial = raw.trim();
  if (!initial) return { name: "", qty: null, note: null };

  let working = initial;
  let qty: string | null = null;
  let note: string | null = null;

  // Pull a parenthetical first — keeps the qty regex from accidentally
  // matching numbers inside the parens.
  const parenMatch = working.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    working = parenMatch[1].trim();
    note = parenMatch[2].trim();
  }

  // Leading qty? "400 g chicken"
  const head = working.match(QTY_HEAD_RE);
  if (head) {
    qty = head[1].trim();
    working = head[2].trim();
  } else {
    // Trailing qty? "Salt — 1 tsp"
    const tail = working.match(QTY_TAIL_RE);
    if (tail) {
      qty = tail[2].trim();
      working = tail[1].trim();
    }
  }

  // Comma-suffix note when we don't already have one. "Carrot, julienned"
  // — but only when the second half doesn't look like a quantity (so we
  // don't eat "Salt, 1 tsp" again).
  if (!note) {
    const commaSplit = working.match(/^(.+?),\s*(.+)$/);
    if (commaSplit) {
      const after = commaSplit[2].trim();
      const looksLikeQty = /\d/.test(after);
      if (!looksLikeQty) {
        working = commaSplit[1].trim();
        note = after;
      }
    }
  }

  const name = working
    ? working.charAt(0).toUpperCase() + working.slice(1)
    : initial;

  return { name, qty, note };
}

/**
 * Sum step times where parseable, return a hand-tuned-ish display
 * string like "~30 min". Returns `null` when no step times were
 * captured or when the total comes out to zero.
 */
function totalStepTimeLabel(steps: Step[]): string | null {
  let totalMinutes = 0;
  let anyParsed = false;
  for (const step of steps) {
    if (!step.time) continue;
    const matches = step.time.matchAll(/(\d+(?:\.\d+)?)\s*(min|minute|minutes|hr|hour|hours)/gi);
    for (const m of matches) {
      const n = Number(m[1]);
      if (!Number.isFinite(n)) continue;
      const unit = m[2].toLowerCase();
      totalMinutes += unit.startsWith("h") ? n * 60 : n;
      anyParsed = true;
    }
  }
  if (!anyParsed || totalMinutes <= 0) return null;
  if (totalMinutes < 60) return `~${Math.round(totalMinutes / 5) * 5 || totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const rem = totalMinutes - hours * 60;
  return rem === 0 ? `~${hours} hr` : `~${hours} hr ${rem} min`;
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

type EffortLevel = "quick" | "easy" | "medium" | "high_effort";

const EFFORT_LABEL: Record<EffortLevel, string> = {
  quick: "Quick to make",
  easy: "Easy effort",
  medium: "Medium effort",
  high_effort: "High effort"
};

type StructuredIngredient = {
  id: string;
  position: number;
  name: string;
  quantityString: string;
  prepNote: string | null;
};

type StructuredStep = {
  id: string;
  position: number;
  title: string;
  time: string | null;
  body: string;
  ingredientIds: string[];
};

function MealDetailBody({
  meal
}: {
  meal: {
    id: string;
    name: string;
    photoUrl: string | null;
    recipeText: string | null;
    recipeSourceUrl: string | null;
    servings: string | null;
    ingredients: string[] | null;
    cookCount: number;
    lastCookedAt: string | Date | null;
    createdByName: string | null;
    effortLevel: EffortLevel | null;
    /** R18/R19 — structured rows. When non-empty, the screen prefers
     *  these over the parsed-from-prose fallback. */
    structuredIngredients?: StructuredIngredient[];
    structuredSteps?: StructuredStep[];
  };
}) {
  const colors = useThemeColors();
  const structuredIngredients = meal.structuredIngredients ?? [];
  const structuredSteps = meal.structuredSteps ?? [];
  // Display ingredients: prefer structured rows (already carry name +
  // qty + prep note); fall back to parsing legacy `ingredients` text[]
  // when the meal predates the Refine flow.
  const legacyIngredients = meal.ingredients ?? [];
  const displayIngredients: ParsedIngredient[] = useMemo(() => {
    if (structuredIngredients.length > 0) {
      return structuredIngredients
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((row) => ({
          name: row.name,
          qty: row.quantityString.trim() || null,
          note: row.prepNote
        }));
    }
    return legacyIngredients.map(parseIngredientLine);
  }, [structuredIngredients, legacyIngredients]);
  // Display steps: prefer structured rows when present.
  const steps: Step[] = useMemo(() => {
    if (structuredSteps.length > 0) {
      const ingredientNameById = new Map<string, string>(
        structuredIngredients.map((i) => [i.id, i.name])
      );
      return structuredSteps
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((row, idx) => ({
          number: idx + 1,
          title: row.title,
          time: row.time,
          body: row.body,
          ingredients: row.ingredientIds
            .map((id) => ingredientNameById.get(id))
            .filter((name): name is string => Boolean(name))
        }));
    }
    return meal.recipeText
      ? parseSteps(meal.recipeText, legacyIngredients)
      : [];
  }, [
    structuredSteps,
    structuredIngredients,
    meal.recipeText,
    legacyIngredients
  ]);
  const totalTime = useMemo(() => totalStepTimeLabel(steps), [steps]);
  const ingredientCount = displayIngredients.length;

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
            accessibilityLabel="Refine recipe"
            onPress={() =>
              router.push(`/(authed)/meal/${meal.id}/refine` as never)
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
            className="font-mono text-label text-ink-3 dark:text-ink-3-dark uppercase"
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
          {meal.effortLevel ? (
            <Chip
              tone="sage"
              icon={
                <Ionicons
                  name="speedometer-outline"
                  size={14}
                  color={colors.forest}
                />
              }
            >
              {EFFORT_LABEL[meal.effortLevel]}
            </Chip>
          ) : null}
          {meal.servings?.trim() ? (
            <Chip tone="ghost">{meal.servings.trim()}</Chip>
          ) : null}
          {totalTime ? (
            <Chip tone="ghost">{totalTime}</Chip>
          ) : (
            <Chip tone="ghost">{`${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}`}</Chip>
          )}
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
          displayIngredients={displayIngredients}
          canExtract={Boolean(meal.recipeText?.trim())}
        />

        {steps.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <SectionLabel
              action={
                <Text
                  className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
                  style={{ letterSpacing: 1.2 }}
                >
                  Follow in order
                </Text>
              }
            >
              Recipe
            </SectionLabel>
            <View style={{ gap: 14 }}>
              {steps.map((step, idx) => (
                <StepCard
                  key={step.number}
                  step={step}
                  isLast={idx === steps.length - 1}
                />
              ))}
            </View>
          </View>
        ) : meal.recipeText ? (
          <View style={{ marginBottom: 18 }}>
            <SectionLabel>Recipe</SectionLabel>
            <Card>
              <View style={{ padding: 18 }}>
                <Text
                  className="font-body text-body-lg text-ink dark:text-ink-dark"
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
            <Text className="font-display-italic text-body-lg text-ink-3 dark:text-ink-3-dark">
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
      className="font-body-semibold text-body-sm text-forest dark:text-forest-dark"
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
  displayIngredients,
  canExtract
}: {
  mealId: string;
  mealName: string;
  displayIngredients: ParsedIngredient[];
  canExtract: boolean;
}) {
  const colors = useThemeColors();
  const utils = trpc.useUtils();
  const [checked, setChecked] = useState<boolean[]>(() =>
    displayIngredients.map(() => false)
  );

  useEffect(() => {
    setChecked((prev) =>
      prev.length === displayIngredients.length
        ? prev
        : displayIngredients.map(() => false)
    );
  }, [displayIngredients.length]);

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

  if (displayIngredients.length === 0) {
    return (
      <View style={{ marginBottom: 30 }}>
        <SectionLabel>Ingredients</SectionLabel>
        {canExtract ? (
          <View style={{ gap: 10 }}>
            <Text className="font-display-italic text-body-lg text-ink-3 dark:text-ink-3-dark">
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
          <Text className="font-display-italic text-body-lg text-ink-3 dark:text-ink-3-dark">
            No ingredients saved yet. Edit on the web to add them.
          </Text>
        )}
      </View>
    );
  }

  const remainingIngredients = displayIngredients.filter(
    (_, i) => !checked[i]
  );
  const remainingCount = remainingIngredients.length;
  const remainingLines = remainingIngredients.map((ing) =>
    [ing.qty, ing.name, ing.note].filter(Boolean).join(" ")
  );

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
        message: buildShoppingListText(mealName, remainingLines)
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
    await Clipboard.setStringAsync(
      buildShoppingListText(mealName, remainingLines)
    );
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
            className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {`${remainingCount} of ${displayIngredients.length} to buy`}
          </Text>
        }
      >
        Ingredients
      </SectionLabel>

      <Card style={{ marginBottom: 14, overflow: "hidden" }}>
        {displayIngredients.map((parsed, i) => (
          <IngredientRow
            key={`${parsed.name}-${i}`}
            parsed={parsed}
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
  parsed,
  checked,
  isFirst,
  onToggle
}: {
  parsed: ParsedIngredient;
  checked: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  const colors = useThemeColors();
  const a11yLabel = [parsed.qty, parsed.name, parsed.note]
    .filter(Boolean)
    .join(" ");
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={a11yLabel || parsed.name}
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
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8
        }}
      >
        <Text
          style={{
            fontFamily: "Geist_500Medium",
            fontSize: 14.5,
            color: checked ? colors.ink3 : colors.ink,
            letterSpacing: -0.1,
            textDecorationLine: checked ? "line-through" : "none",
            textDecorationColor: colors.ink4
          }}
        >
          {parsed.name}
        </Text>
        {parsed.note ? (
          <Text
            style={{
              fontFamily: "InstrumentSerif_400Regular_Italic",
              fontSize: 11.5,
              color: colors.ink3,
              textDecorationLine: checked ? "line-through" : "none",
              textDecorationColor: colors.ink4
            }}
          >
            {parsed.note}
          </Text>
        ) : null}
      </View>
      {parsed.qty ? (
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 11.5,
            color: checked ? colors.ink4 : colors.ink2,
            letterSpacing: 0.4,
            textDecorationLine: checked ? "line-through" : "none",
            textDecorationColor: colors.ink4
          }}
          numberOfLines={1}
        >
          {parsed.qty}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* ─── Step card ─────────────────────────────────────────────────── */

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  const colors = useThemeColors();
  const hasBody = step.body.length > 0;
  const hasItems = step.ingredients.length > 0;
  return (
    <Card>
      <View style={{ padding: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 12,
            marginBottom: hasBody || hasItems ? 8 : 0
          }}
        >
          <Text
            style={{
              fontFamily: "InstrumentSerif_400Regular_Italic",
              fontSize: 32,
              lineHeight: 32,
              color: colors.forest,
              letterSpacing: -0.64,
              minWidth: 28
            }}
          >
            {step.number}.
          </Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: "InstrumentSerif_400Regular",
                fontSize: 22,
                lineHeight: 22 * 1.05,
                color: colors.ink,
                letterSpacing: -0.44
              }}
            >
              {step.title}
            </Text>
            {step.time ? (
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 10.5,
                  color: colors.ink3,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginTop: 4
                }}
              >
                {step.time}
              </Text>
            ) : null}
          </View>
        </View>
        {hasBody ? (
          <Text
            style={{
              fontFamily: "Geist_400Regular",
              fontSize: 14,
              lineHeight: 21,
              color: colors.ink2,
              letterSpacing: -0.1,
              marginLeft: 40,
              marginBottom: hasItems ? 12 : 0
            }}
          >
            {step.body}
          </Text>
        ) : null}
        {hasItems ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginLeft: 40
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
        {!isLast ? (
          <View
            style={{
              marginLeft: 12,
              marginTop: 14,
              marginBottom: -4,
              flexDirection: "row",
              alignItems: "center",
              gap: 8
            }}
            accessibilityElementsHidden
          >
            <Ionicons name="arrow-down" size={14} color={colors.ink4} />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: colors.ink4
              }}
            >
              Then
            </Text>
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
  const colors = useThemeColors();
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
