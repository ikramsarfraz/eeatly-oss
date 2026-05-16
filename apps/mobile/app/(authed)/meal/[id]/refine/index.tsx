import { useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { TopNav } from "../../../../../components/top-nav";
import { DiffRow } from "../../../../../components/refine/diff-row";
import { colors } from "../../../../../lib/design/tokens";
import { useRefineSession } from "../../../../../lib/refine-session";
import type { RefineSource } from "../../../../../lib/refine-session";
import { trpc } from "../../../../../lib/trpc";
import {
  Card,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  Screen,
  SectionLabel
} from "../../../../../components/ui";

/**
 * Round 20 — Refine recipe screen.
 *
 * Reached by tapping the pencil on the Recipe Detail screen. Same
 * screen will also serve as the post-Capture-with-AI review surface
 * once the capture flow is rerouted here.
 *
 * Stack, top to bottom:
 *   1. TopNav — "Refine recipe", back chevron, "Discard" right (turns
 *      danger when there are pending changes).
 *   2. Identity strip — small monogram + meal name + mono "N
 *      INGREDIENTS · M STEPS · EFFORT" + wheat "EDITING" chip.
 *   3. Prompt composer — sage-tinted card with sparkle eyebrow, big
 *      serif headline, three-mode pill segment (Text/Voice/Photo),
 *      mode-specific input surface, and a row of example chips.
 *   4. "This session" chat history of prior turns. Right-aligned user
 *      bubbles + AI reply Cards with `Proposed · N changes` eyebrow
 *      and `DiffRow`s.
 *   5. Pending changes summary with `+N` / `~N` count pills.
 *   6. Primary CTA — "Review & save · N" → pushes the review route.
 *
 * Voice + photo modes are wired as affordances only; submission lands
 * once the AI backend procedure ships. Text mode submits through the
 * placeholder echo path in `useRefineSession`.
 */

type Mode = RefineSource;

const SOURCE_ICONS: Record<Mode, keyof typeof Ionicons.glyphMap> = {
  text: "document-text-outline",
  voice: "mic-outline",
  photo: "camera-outline"
};

const EXAMPLE_CHIPS = [
  "Make it spicier",
  "Convert to grams",
  "Halve for 2 people",
  "Add prep notes"
];

function effortDisplay(level: string | null | undefined): string | null {
  if (!level) return null;
  if (level === "quick") return "quick";
  if (level === "easy") return "easy";
  if (level === "medium") return "medium";
  if (level === "high_effort") return "high";
  return null;
}

export default function RefineRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = typeof id === "string" ? id : "";

  const query = trpc.meals.getById.useQuery(
    { mealId },
    { enabled: mealId.length > 0, staleTime: 30_000 }
  );
  const meal = query.data;

  const { session, submitText, clear, counts } = useRefineSession(mealId);
  const [mode, setMode] = useState<Mode>("text");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  if (query.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Refine recipe" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!meal) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Refine recipe" back showSettings={false} />
        <ErrorScreen
          title="Recipe not found"
          body="It may have been archived since you opened it."
        />
      </Screen>
    );
  }

  const ingredientCount = meal.ingredients?.length ?? 0;
  const effort = effortDisplay(meal.effortLevel);
  const metaParts = [
    `${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}`
  ];
  // The recipe schema doesn't track structured steps yet, so the strip
  // shows ingredient + effort + cook count. The handoff "N steps" hint
  // is approximated by cook count where available.
  if (effort) metaParts.push(effort);
  if (meal.cookCount > 0) {
    metaParts.push(
      `${meal.cookCount} cook${meal.cookCount === 1 ? "" : "s"}`
    );
  }
  const meta = metaParts.join(" · ");

  function handleSubmitText() {
    if (!draft.trim()) return;
    submitText(draft);
    setDraft("");
  }

  function handleExampleChip(text: string) {
    submitText(text);
  }

  function handleVoiceTap() {
    Alert.alert(
      "Voice refine",
      "Voice prompting will arrive with the AI refinement backend."
    );
  }

  function handlePhotoTap() {
    Alert.alert(
      "Photo refine",
      "Photo prompting will arrive with the AI refinement backend."
    );
  }

  function handleDiscard() {
    if (counts.total === 0) {
      router.back();
      return;
    }
    Alert.alert(
      "Discard refinements?",
      `You'll lose ${counts.total} pending change${counts.total === 1 ? "" : "s"}.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            clear();
            router.back();
          }
        }
      ]
    );
  }

  const discardLabel = counts.total > 0 ? "Discard" : "Discard";
  const discardColor = counts.total > 0 ? colors.danger : colors.ink3;

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Refine recipe"
        back
        showSettings={false}
        right={
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={discardLabel}
            onPress={handleDiscard}
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 14,
                color: discardColor,
                letterSpacing: -0.1
              }}
            >
              {discardLabel}
            </Text>
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 6,
            paddingBottom: 24
          }}
          keyboardShouldPersistTaps="handled"
        >
          <IdentityStrip
            name={meal.name}
            photoUrl={meal.photoUrl}
            meta={meta}
          />

          <PromptComposer
            mode={mode}
            onModeChange={setMode}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleSubmitText}
            onVoiceTap={handleVoiceTap}
            onPhotoTap={handlePhotoTap}
            inputRef={inputRef}
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
            {EXAMPLE_CHIPS.map((c) => (
              <Pressable
                key={c}
                onPress={() => handleExampleChip(c)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: "rgba(255,255,255,0.6)",
                  borderWidth: 1,
                  borderColor: "rgba(46,87,57,0.07)"
                }}
                accessibilityRole="button"
                accessibilityLabel={c}
              >
                <Text
                  style={{
                    fontFamily: "Geist_500Medium",
                    fontSize: 12,
                    color: colors.ink2,
                    letterSpacing: -0.05
                  }}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>

          {session.turns.length > 0 ? (
            <View style={{ marginBottom: 4 }}>
              <SectionLabel
                action={
                  <Text
                    className="font-mono text-eyebrow text-ink-3 uppercase"
                    style={{ letterSpacing: 1.2 }}
                  >
                    {`${session.turns.length} turn${session.turns.length === 1 ? "" : "s"}`}
                  </Text>
                }
              >
                This session
              </SectionLabel>
              {session.isPlaceholder ? (
                <Text
                  className="font-display-italic text-body-sm text-ink-3"
                  style={{ marginBottom: 12 }}
                >
                  Example session — submit a prompt above to start your own.
                </Text>
              ) : null}
              <View style={{ gap: 14, marginBottom: 18 }}>
                {session.turns.map((turn) => (
                  <View key={turn.id} style={{ gap: 8 }}>
                    <UserBubble source={turn.source} text={turn.prompt} />
                    <Card style={{ backgroundColor: colors.paper, padding: 14 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8
                        }}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={14}
                          color={colors.forest}
                        />
                        <Text
                          className="font-mono text-eyebrow text-forest uppercase"
                          style={{ letterSpacing: 1.2 }}
                        >
                          {`Proposed · ${turn.proposed.length} change${turn.proposed.length === 1 ? "" : "s"}`}
                        </Text>
                      </View>
                      {turn.proposed.map((change) => (
                        <DiffRow
                          key={change.id}
                          kind={change.kind}
                          label={change.label}
                          note={
                            change.kind === "add"
                              ? change.after
                              : change.kind === "change"
                                ? change.where
                                : change.before
                          }
                        />
                      ))}
                    </Card>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <SectionLabel
            action={
              <Text
                style={{
                  fontFamily: "Geist_500Medium",
                  fontSize: 12.5,
                  color: colors.ink3,
                  letterSpacing: -0.05
                }}
              >
                Or edit by hand →
              </Text>
            }
          >
            Pending changes
          </SectionLabel>
          <Card style={{ marginBottom: 22, padding: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 13.5,
                  color: colors.ink,
                  letterSpacing: -0.1
                }}
              >
                {`${counts.total} change${counts.total === 1 ? "" : "s"} ready`}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {counts.add > 0 ? (
                  <CountPill bg={colors.sageBg} fg={colors.forest}>
                    {`+${counts.add}`}
                  </CountPill>
                ) : null}
                {counts.change > 0 ? (
                  <CountPill bg="#F4EEDB" fg="#8A6B22">
                    {`~${counts.change}`}
                  </CountPill>
                ) : null}
                {counts.remove > 0 ? (
                  <CountPill bg={colors.dangerSoft} fg={colors.danger}>
                    {`-${counts.remove}`}
                  </CountPill>
                ) : null}
              </View>
            </View>
            <Text
              style={{
                fontFamily: "Geist_400Regular",
                fontSize: 12.5,
                color: colors.ink2,
                lineHeight: 19
              }}
            >
              We&apos;ll roll all your refinements into one save. Review
              them in the next step before they overwrite the recipe.
            </Text>
          </Card>

          <Pressable
            onPress={() =>
              router.push(`/(authed)/meal/${mealId}/refine/review` as never)
            }
            disabled={counts.total === 0}
            accessibilityRole="button"
            accessibilityLabel={`Review and save ${counts.total} changes`}
            style={{
              opacity: counts.total === 0 ? 0.5 : 1,
              paddingVertical: 16,
              paddingHorizontal: 22,
              borderRadius: 99,
              backgroundColor: colors.forest,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              shadowColor: colors.forest,
              shadowOpacity: 0.35,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 20,
              elevation: 4
            }}
            className="active:opacity-90"
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 15.5,
                color: colors.forestText,
                letterSpacing: -0.1
              }}
            >
              Review & save
            </Text>
            <View
              style={{
                paddingVertical: 2,
                paddingHorizontal: 9,
                borderRadius: 99,
                backgroundColor: "rgba(245,239,226,0.18)"
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist_700Bold",
                  fontSize: 12,
                  color: colors.forestText
                }}
              >
                {counts.total}
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function IdentityStrip({
  name,
  photoUrl,
  meta
}: {
  name: string;
  photoUrl: string | null;
  meta: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
        paddingVertical: 10,
        paddingLeft: 10,
        paddingRight: 12,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft
      }}
    >
      <View style={{ width: 44, height: 44 }}>
        <MealTile name={name} size="sm" photoUrl={photoUrl} radius={8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: "InstrumentSerif_400Regular",
            fontSize: 18,
            lineHeight: 20,
            color: colors.ink,
            letterSpacing: -0.36,
            marginBottom: 4
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 10,
            color: colors.ink3,
            letterSpacing: 1.1,
            textTransform: "uppercase"
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <View
        style={{
          paddingVertical: 4,
          paddingHorizontal: 9,
          borderRadius: 99,
          backgroundColor: "#F4EEDB"
        }}
      >
        <Text
          style={{
            fontFamily: "JetBrainsMono_600SemiBold",
            fontSize: 10,
            color: "#8A6B22",
            letterSpacing: 1,
            textTransform: "uppercase"
          }}
        >
          Editing
        </Text>
      </View>
    </View>
  );
}

function PromptComposer({
  mode,
  onModeChange,
  draft,
  onDraftChange,
  onSubmit,
  onVoiceTap,
  onPhotoTap,
  inputRef
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  draft: string;
  onDraftChange: (s: string) => void;
  onSubmit: () => void;
  onVoiceTap: () => void;
  onPhotoTap: () => void;
  inputRef: React.MutableRefObject<TextInput | null>;
}) {
  return (
    <View
      style={{
        borderRadius: 22,
        paddingVertical: 20,
        paddingHorizontal: 18,
        backgroundColor: "#EDEEDF",
        borderWidth: 1,
        borderColor: "#DBDFC4",
        marginBottom: 14
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 10
        }}
      >
        <Ionicons name="sparkles-outline" size={16} color={colors.forest} />
        <Text
          style={{
            fontFamily: "JetBrainsMono_600SemiBold",
            fontSize: 10.5,
            color: colors.forest,
            letterSpacing: 1.3,
            textTransform: "uppercase"
          }}
        >
          Tell me what to change
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "InstrumentSerif_400Regular",
          fontSize: 26,
          lineHeight: 28,
          color: colors.ink,
          letterSpacing: -0.52,
          marginBottom: 16
        }}
      >
        Add an ingredient, fix a quantity, rewrite a step.
      </Text>

      <ModeTabs mode={mode} onChange={onModeChange} />

      {mode === "text" ? (
        <TextInputSurface
          draft={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          onVoiceTap={onVoiceTap}
          onPhotoTap={onPhotoTap}
          inputRef={inputRef}
        />
      ) : null}
      {mode === "voice" ? <VoiceInputSurface onTap={onVoiceTap} /> : null}
      {mode === "photo" ? <PhotoInputSurface onTap={onPhotoTap} /> : null}
    </View>
  );
}

function ModeTabs({
  mode,
  onChange
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const modes: Mode[] = ["text", "voice", "photo"];
  const labels: Record<Mode, string> = {
    text: "Text",
    voice: "Voice",
    photo: "Photo"
  };
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.55)",
        borderWidth: 1,
        borderColor: "rgba(46,87,57,0.06)",
        marginBottom: 14
      }}
    >
      {modes.map((m) => {
        const on = mode === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 99,
              backgroundColor: on ? colors.forest : "transparent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <Ionicons
              name={SOURCE_ICONS[m]}
              size={14}
              color={on ? colors.forestText : colors.ink2}
            />
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 13,
                color: on ? colors.forestText : colors.ink2,
                letterSpacing: -0.1
              }}
            >
              {labels[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TextInputSurface({
  draft,
  onChange,
  onSubmit,
  onVoiceTap,
  onPhotoTap,
  inputRef
}: {
  draft: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onVoiceTap: () => void;
  onPhotoTap: () => void;
  inputRef: React.MutableRefObject<TextInput | null>;
}) {
  const canSubmit = draft.trim().length > 0;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingTop: 14,
        paddingHorizontal: 14,
        paddingBottom: 10
      }}
    >
      <TextInput
        ref={(node) => {
          inputRef.current = node;
        }}
        value={draft}
        onChangeText={onChange}
        placeholder={`e.g. "Bump the chicken to 600 g and add ginger paste, 1 tbsp."`}
        placeholderTextColor={colors.ink3}
        multiline
        style={{
          minHeight: 56,
          fontFamily: "InstrumentSerif_400Regular_Italic",
          fontSize: 14.5,
          lineHeight: 22,
          color: colors.ink,
          padding: 0
        }}
        textAlignVertical="top"
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft
        }}
      >
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Pressable
            hitSlop={6}
            onPress={onPhotoTap}
            accessibilityRole="button"
            accessibilityLabel="Refine from photo"
          >
            <Ionicons name="camera-outline" size={16} color={colors.ink3} />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={onPhotoTap}
            accessibilityRole="button"
            accessibilityLabel="Refine from image"
          >
            <Ionicons name="image-outline" size={16} color={colors.ink3} />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={onVoiceTap}
            accessibilityRole="button"
            accessibilityLabel="Refine from voice"
          >
            <Ionicons name="mic-outline" size={16} color={colors.ink3} />
          </Pressable>
        </View>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Submit refinement"
          style={{
            width: 32,
            height: 32,
            borderRadius: 99,
            backgroundColor: colors.forest,
            alignItems: "center",
            justifyContent: "center",
            opacity: canSubmit ? 1 : 0.45
          }}
        >
          <Ionicons name="arrow-up" size={16} color={colors.forestText} />
        </Pressable>
      </View>
    </View>
  );
}

function VoiceInputSurface({ onTap }: { onTap: () => void }) {
  // Fake bar heights matching the handoff mock; in production these come
  // from the live mic level reader.
  const bars = useMemo(
    () => [6, 11, 16, 9, 18, 12, 20, 8, 14, 10, 17, 6, 13, 19, 11, 7],
    []
  );
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 22,
        paddingHorizontal: 14,
        alignItems: "center",
        gap: 12
      }}
    >
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel="Hold to record"
        style={{
          width: 68,
          height: 68,
          borderRadius: 99,
          backgroundColor: colors.forest,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.forest,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 20,
          elevation: 4
        }}
      >
        <Ionicons name="mic-outline" size={28} color={colors.forestText} />
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          height: 22
        }}
      >
        {bars.map((h, i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 99,
              backgroundColor: colors.forest,
              opacity: 0.85 - (i % 5) * 0.07
            }}
          />
        ))}
      </View>
      <Text
        style={{
          fontFamily: "JetBrainsMono_400Regular",
          fontSize: 10.5,
          color: colors.ink3,
          letterSpacing: 1.2,
          textTransform: "uppercase"
        }}
      >
        0:04 · Listening
      </Text>
    </View>
  );
}

function PhotoInputSurface({ onTap }: { onTap: () => void }) {
  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel="Snap a change"
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: colors.border,
        paddingVertical: 22,
        paddingHorizontal: 16,
        alignItems: "center",
        gap: 6
      }}
    >
      <Ionicons name="camera-outline" size={28} color={colors.forest} />
      <Text
        style={{
          fontFamily: "Geist_600SemiBold",
          fontSize: 14.5,
          color: colors.ink
        }}
      >
        Snap a change
      </Text>
      <Text
        style={{
          fontFamily: "JetBrainsMono_400Regular",
          fontSize: 10,
          color: colors.ink3,
          letterSpacing: 1.1,
          textTransform: "uppercase"
        }}
      >
        Handwritten note · sticky · cookbook page
      </Text>
    </Pressable>
  );
}

function UserBubble({
  source,
  text
}: {
  source: RefineSource;
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
      <View
        style={{
          maxWidth: "78%",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderBottomRightRadius: 4,
          backgroundColor: colors.forest,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8
        }}
      >
        <Ionicons
          name={SOURCE_ICONS[source]}
          size={14}
          color={colors.forestText}
          style={{ opacity: 0.85, marginTop: 2 }}
        />
        <Text
          style={{
            flexShrink: 1,
            fontFamily: "Geist_400Regular",
            fontSize: 14,
            lineHeight: 20,
            color: colors.forestText,
            letterSpacing: -0.1
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

function CountPill({
  bg,
  fg,
  children
}: {
  bg: string;
  fg: string;
  children: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 99,
        backgroundColor: bg
      }}
    >
      <Text
        style={{
          fontFamily: "Geist_600SemiBold",
          fontSize: 11,
          color: fg
        }}
      >
        {children}
      </Text>
    </View>
  );
}
