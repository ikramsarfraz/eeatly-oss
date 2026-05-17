import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState
} from "expo-audio";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import type {
  HeadsUp,
  PendingChange,
  RefineSource
} from "@eeatly/api/validators/refine";
import { TopNav } from "../../../../../components/top-nav";
import {
  useThemeColors,
  useIsDark
} from "../../../../../lib/design/use-theme-colors";
import type { ThemeColors } from "../../../../../lib/design/tokens";

/**
 * Wheat palette for the "EDITING" identity chip + the `~changes` count
 * pill. Mirrors the Chip primitive's `wheat` tone (apps/mobile/components/
 * ui/chip.tsx) but exposed inline so the StyleSheet-using surfaces don't
 * need to wrap in a `<Chip>`.
 */
function wheatPalette(isDark: boolean): { bg: string; fg: string } {
  return isDark
    ? { bg: "#3A2F18", fg: "#C9B176" }
    : { bg: "#EDDFB7", fg: "#6F571E" };
}
import { getDeviceId } from "../../../../../lib/device-id";
import {
  pickRefinePhoto,
  RefinePhotoError,
  type RefinePhotoBundle,
  type RefinePhotoSource
} from "../../../../../lib/refine-photo";
import {
  readAudioForAi,
  AudioReadError
} from "../../../../../lib/audio-upload";
import {
  describePendingChange,
  summariseCounts
} from "../../../../../lib/refine-format";
import { trpc } from "../../../../../lib/trpc";

/**
 * Local mirror of the backend's `SessionState` shape (services/refine.ts).
 * Kept inline rather than imported from `services/` because that's
 * `server-only` code; defining the type here gives the screen + sub-
 * components a stable shape to type-pass without dragging server code
 * into the mobile bundle. The wire format is enforced by the validators
 * (`PendingChange`, `HeadsUp`) we import directly.
 */
type RefineTurn = {
  id: string;
  position: number;
  source: RefineSource;
  prompt: string;
  attachmentUrl: string | null;
  proposed: PendingChange[];
  accepted: boolean;
  createdAt: Date;
};

type RefineSessionState = {
  sessionId: string;
  mealId: string;
  startedAt: Date;
  turns: RefineTurn[];
  pendingChanges: PendingChange[];
  summary: { additions: number; changes: number; removals: number };
  headsUp: HeadsUp[];
};
import {
  Card,
  ErrorScreen,
  LoadingScreen,
  MealTile,
  Screen,
  SectionLabel,
  Toast
} from "../../../../../components/ui";
import { DiffRow } from "../../../../../components/refine/diff-row";

/**
 * Round 20 — Refine recipe screen.
 *
 * Replaces the R19 stub. Wires three input modes (text / voice / photo)
 * end-to-end through the R18 `trpc.refine.*` procedures.
 *
 * Stack:
 *   1. TopNav — back chevron, title, "Discard" right (turns danger when
 *      there are pending changes).
 *   2. Identity strip — MealTile sm + name + mono meta + wheat
 *      "EDITING" chip.
 *   3. Prompt composer — sage card with sparkle eyebrow, big serif
 *      headline, three-tab mode picker, mode-specific input surface,
 *      example chips.
 *   4. "This session" chat history — user bubbles + AI proposal cards;
 *      tap a card to toggle accept/reject (server-side recompute).
 *   5. Pending changes summary — `+N` / `~N` / `−N` count pills.
 *   6. Primary CTA — `Review & save · N` → pushes review route with
 *      `?sessionId=` so Review reads the same draft.
 *
 * Session lifecycle:
 *   - On mount, resolve device id (SecureStore-backed UUID) and call
 *     `refine.startSession`. The service is idempotent — if an active
 *     session exists for this (meal, user, device), it resumes;
 *     otherwise a new one is inserted.
 *   - All turn mutations (`submitTextTurn`, `submitVoiceTurn`,
 *     `submitPhotoTurn`, `toggleTurnAccepted`) return the full
 *     `SessionState`. We write the response straight into
 *     `getPendingChanges`'s React Query cache, so the chat history +
 *     pending summary update without a refetch.
 *   - Discarding closes the session server-side; the screen pops.
 *
 * Decisions worth flagging:
 *   - The voice surface uses `expo-audio` directly (mic button +
 *     animated waveform + duration), NOT the R15 `<VoiceRecorder>`
 *     component. The component has its own phase-shifting UI (Record
 *     → Stop → Preview); the composer needs the input to stay inside
 *     the card. The animated waveform is decorative — 24 bars
 *     re-randomised on a 120 ms interval. Real amplitude-driven bars
 *     are parked.
 *   - The photo surface uses `Alert.alert` for the camera/library
 *     action sheet rather than a custom modal. iOS HIG and Android
 *     both render an alert with 3 buttons cleanly; saves a Modal mount.
 *   - Example chip tap fills the input but doesn't auto-submit — gives
 *     the user a chance to edit before sending (per R20 spec).
 *   - Pending-change summary derives its display strings from the
 *     `refine-format` helper, which resolves `refId` against the
 *     meal's structured ingredients/steps for human-readable labels.
 */

type Mode = "text" | "voice" | "photo";

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

const MAX_RECORD_MS = 5 * 60 * 1000;

function effortDisplay(level: string | null | undefined): string | null {
  if (!level) return null;
  if (level === "quick") return "quick";
  if (level === "easy") return "easy";
  if (level === "medium") return "medium";
  if (level === "high_effort") return "high";
  return null;
}

export default function RefineRecipeScreen() {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const wheat = wheatPalette(isDark);
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = typeof id === "string" ? id : "";

  const mealQuery = trpc.meals.getById.useQuery(
    { mealId },
    { enabled: mealId.length > 0, staleTime: 30_000 }
  );

  /* ─── Session bootstrap ──────────────────────────────────────── */

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);

  const startSessionMut = trpc.refine.startSession.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      // Seed the query cache so getPendingChanges below reads through
      // without a separate round-trip.
      utils.refine.getPendingChanges.setData({ sessionId: data.sessionId }, data);
    },
    onError: (err) => {
      setBootstrapError(err.message);
    }
  });

  useEffect(() => {
    if (!mealId || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        if (cancelled) return;
        startSessionMut.mutate({ mealId, deviceId });
      } catch (e) {
        if (cancelled) return;
        setBootstrapError(
          e instanceof Error ? e.message : "Couldn't open a refine session."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  /* ─── Session state query ────────────────────────────────────── */

  const utils = trpc.useUtils();
  const sessionQuery = trpc.refine.getPendingChanges.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: !!sessionId, staleTime: Infinity }
  );
  const sessionState = sessionQuery.data;

  /* ─── UI state ───────────────────────────────────────────────── */

  const [mode, setMode] = useState<Mode>("text");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    variant: "info" | "success" | "error";
  }>({ visible: false, message: "", variant: "info" });
  const inputRef = useRef<TextInput | null>(null);

  function showError(message: string) {
    setToast({ visible: true, message, variant: "error" });
  }

  /* ─── Mutations ──────────────────────────────────────────────── */

  const submitTextTurn = trpc.refine.submitTextTurn.useMutation({
    onSuccess: (data) => {
      if (!sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
    },
    onError: (err) => {
      // Keep the input populated so the user can re-send.
      setDraft((prev) => prev || lastTextPromptRef.current);
      showError(err.message ?? "Couldn't send that prompt.");
    }
  });
  const lastTextPromptRef = useRef("");

  const submitVoiceTurn = trpc.refine.submitVoiceTurn.useMutation({
    onSuccess: (data) => {
      if (!sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
    },
    onError: (err) => {
      showError(err.message ?? "Couldn't process that voice note.");
    }
  });

  const submitPhotoTurn = trpc.refine.submitPhotoTurn.useMutation({
    onSuccess: (data) => {
      if (!sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
    },
    onError: (err) => {
      showError(err.message ?? "Couldn't analyse that photo.");
    }
  });

  const toggleTurnAccepted = trpc.refine.toggleTurnAccepted.useMutation({
    onSuccess: (data) => {
      if (!sessionId) return;
      utils.refine.getPendingChanges.setData({ sessionId }, data);
    },
    onError: (err) => {
      // Roll back the optimistic toggle by refetching.
      if (sessionId) void utils.refine.getPendingChanges.invalidate({ sessionId });
      showError(err.message ?? "Couldn't update that turn.");
    }
  });

  const discardMut = trpc.refine.discard.useMutation({
    onSuccess: () => {
      router.replace(`/(authed)/meal/${mealId}` as never);
    },
    onError: (err) => {
      showError(err.message ?? "Couldn't discard.");
    }
  });

  /* ─── Handlers ───────────────────────────────────────────────── */

  function handleSubmitText() {
    if (!sessionId) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    lastTextPromptRef.current = trimmed;
    setDraft("");
    submitTextTurn.mutate({ sessionId, prompt: trimmed });
  }

  function handleExampleChip(text: string) {
    setDraft(text);
    inputRef.current?.focus();
  }

  async function handleVoiceRecorded(uri: string) {
    if (!sessionId) return;
    try {
      const bundle = await readAudioForAi(uri);
      const mediaType = bundle.mediaType as
        | "audio/mpeg"
        | "audio/mp3"
        | "audio/mp4"
        | "audio/m4a"
        | "audio/x-m4a"
        | "audio/ogg"
        | "audio/opus"
        | "audio/wav"
        | "audio/x-wav"
        | "audio/webm"
        | "audio/flac";
      submitVoiceTurn.mutate({
        sessionId,
        audioBase64: bundle.audioBase64,
        mediaType,
        fileName: bundle.fileName
      });
    } catch (e) {
      if (e instanceof AudioReadError) {
        showError(e.message);
      } else {
        showError("Couldn't read that recording. Try again.");
      }
    }
  }

  function handleDiscard() {
    if (!sessionId) {
      router.back();
      return;
    }
    const totalPending = sessionState?.pendingChanges.length ?? 0;
    if (totalPending === 0 && (sessionState?.turns.length ?? 0) === 0) {
      // Nothing to lose — still close the session server-side so the
      // partial-unique-index doesn't trap the user with a stale active
      // session on next entry.
      discardMut.mutate({ sessionId });
      return;
    }
    Alert.alert(
      "Discard all changes?",
      "This can't be undone.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardMut.mutate({ sessionId })
        }
      ]
    );
  }

  function handleToggleTurn(turnId: string, currentAccepted: boolean) {
    if (!sessionId) return;
    // Optimistic toggle: flip in cache immediately, then send. onError
    // invalidates to recover the real state.
    const current = utils.refine.getPendingChanges.getData({ sessionId });
    if (current) {
      const nextTurns = current.turns.map((t) =>
        t.id === turnId ? { ...t, accepted: !currentAccepted } : t
      );
      // Pending changes will be recomputed server-side; locally we drop
      // this turn's changes when un-accepting (best-effort preview).
      const nextPending = nextTurns
        .filter((t) => t.accepted)
        .flatMap((t) => t.proposed);
      utils.refine.getPendingChanges.setData(
        { sessionId },
        {
          ...current,
          turns: nextTurns,
          pendingChanges: nextPending,
          summary: {
            additions: nextPending.filter((c) => c.kind === "add").length,
            changes: nextPending.filter((c) => c.kind === "change").length,
            removals: nextPending.filter((c) => c.kind === "remove").length
          }
        }
      );
    }
    toggleTurnAccepted.mutate({
      sessionId,
      turnId,
      accepted: !currentAccepted
    });
  }

  /* ─── Loading / error states ─────────────────────────────────── */

  if (mealQuery.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Refine recipe" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!mealQuery.data) {
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

  if (bootstrapError && !sessionId) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Refine recipe" back showSettings={false} />
        <ErrorScreen
          title="Couldn't open Refine"
          body={bootstrapError}
        />
      </Screen>
    );
  }

  if (!sessionState) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Refine recipe" back showSettings={false} />
        <LoadingScreen />
      </Screen>
    );
  }

  const meal = mealQuery.data;
  const ingredientCount = meal.ingredients?.length ?? 0;
  const stepCount = meal.structuredSteps?.length ?? 0;
  const effort = effortDisplay(meal.effortLevel);
  const metaParts: string[] = [];
  if (ingredientCount > 0) {
    metaParts.push(`${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}`);
  }
  if (stepCount > 0) {
    metaParts.push(`${stepCount} step${stepCount === 1 ? "" : "s"}`);
  } else {
    metaParts.push("Recipe");
  }
  if (effort) metaParts.push(effort);
  const meta = metaParts.join(" · ");

  const counts = summariseCounts(sessionState.pendingChanges);
  const turnCount = sessionState.turns.length;
  const submitting =
    submitTextTurn.isPending ||
    submitVoiceTurn.isPending ||
    submitPhotoTurn.isPending;

  const resolverCtx = {
    ingredients: meal.structuredIngredients ?? [],
    steps: meal.structuredSteps ?? []
  };

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
            accessibilityLabel="Discard"
            onPress={handleDiscard}
            disabled={discardMut.isPending}
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 14,
                color: counts.total > 0 ? colors.danger : colors.ink3,
                letterSpacing: -0.1,
                opacity: discardMut.isPending ? 0.5 : 1
              }}
            >
              Discard
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
            paddingBottom: 32
          }}
          keyboardShouldPersistTaps="handled"
        >
          <IdentityStrip
            name={meal.name}
            photoUrl={meal.photoUrl}
            meta={meta}
            colors={colors}
            wheat={wheat}
          />

          <PromptComposer
            mode={mode}
            onModeChange={setMode}
            draft={draft}
            onDraftChange={setDraft}
            onSubmitText={handleSubmitText}
            onVoiceRecorded={handleVoiceRecorded}
            onPhotoSubmit={(bundle) =>
              sessionId &&
              submitPhotoTurn.mutate({
                sessionId,
                imageBase64: bundle.imageBase64,
                mediaType: bundle.mediaType
              })
            }
            onPhotoError={showError}
            submitting={submitting}
            voiceSubmitting={submitVoiceTurn.isPending}
            photoSubmitting={submitPhotoTurn.isPending}
            inputRef={inputRef}
            colors={colors}
          />

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 24
            }}
          >
            {EXAMPLE_CHIPS.map((c) => (
              <Pressable
                key={c}
                onPress={() => handleExampleChip(c)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 99,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderSoft
                }}
                accessibilityRole="button"
                accessibilityLabel={`Example: ${c}`}
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

          {turnCount > 0 ? (
            <SessionHistory
              turns={sessionState.turns}
              resolverCtx={resolverCtx}
              onTogglePress={handleToggleTurn}
              colors={colors}
            />
          ) : (
            <View style={{ marginBottom: 18 }}>
              <SectionLabel>This session</SectionLabel>
              <Text
                className="font-display-italic text-body-md text-ink-3 dark:text-ink-3-dark"
                style={{ marginBottom: 4 }}
              >
                Send a refinement above to get started.
              </Text>
            </View>
          )}

          {counts.total > 0 ? (
            <>
              <SectionLabel
                action={
                  <Text
                    style={{
                      fontFamily: "Geist_500Medium",
                      fontSize: 12.5,
                      color: colors.ink4,
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
                      <CountPill bg={wheat.bg} fg={wheat.fg}>
                        {`~${counts.change}`}
                      </CountPill>
                    ) : null}
                    {counts.remove > 0 ? (
                      <CountPill bg={colors.dangerSoft} fg={colors.danger}>
                        {`−${counts.remove}`}
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
            </>
          ) : null}

          <Pressable
            onPress={() =>
              sessionId &&
              router.push(
                `/(authed)/meal/${mealId}/refine/review?sessionId=${encodeURIComponent(
                  sessionId
                )}` as never
              )
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

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </Screen>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function IdentityStrip({
  name,
  photoUrl,
  meta,
  colors,
  wheat
}: {
  name: string;
  photoUrl: string | null;
  meta: string;
  colors: ThemeColors;
  wheat: { bg: string; fg: string };
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
          backgroundColor: wheat.bg
        }}
      >
        <Text
          style={{
            fontFamily: "JetBrainsMono_600SemiBold",
            fontSize: 10,
            color: wheat.fg,
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
  onSubmitText,
  onVoiceRecorded,
  onPhotoSubmit,
  onPhotoError,
  submitting,
  voiceSubmitting,
  photoSubmitting,
  inputRef,
  colors
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  draft: string;
  onDraftChange: (s: string) => void;
  onSubmitText: () => void;
  onVoiceRecorded: (uri: string) => void;
  onPhotoSubmit: (bundle: RefinePhotoBundle) => void;
  onPhotoError: (message: string) => void;
  submitting: boolean;
  voiceSubmitting: boolean;
  photoSubmitting: boolean;
  inputRef: React.MutableRefObject<TextInput | null>;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        borderRadius: 22,
        paddingVertical: 20,
        paddingHorizontal: 18,
        backgroundColor: colors.sageBg,
        borderWidth: 1,
        borderColor: colors.sageDeep,
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

      <ModeTabs mode={mode} onChange={onModeChange} colors={colors} />

      {mode === "text" ? (
        <TextInputSurface
          draft={draft}
          onChange={onDraftChange}
          onSubmit={onSubmitText}
          onModeShortcut={onModeChange}
          submitting={submitting}
          inputRef={inputRef}
          colors={colors}
        />
      ) : null}
      {mode === "voice" ? (
        <VoiceInputSurface
          onRecorded={onVoiceRecorded}
          submitting={voiceSubmitting}
          colors={colors}
        />
      ) : null}
      {mode === "photo" ? (
        <PhotoInputSurface
          onSubmit={onPhotoSubmit}
          onError={onPhotoError}
          submitting={photoSubmitting}
          colors={colors}
        />
      ) : null}
    </View>
  );
}

function ModeTabs({
  mode,
  onChange,
  colors
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  colors: ThemeColors;
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
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.borderSoft,
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
            accessibilityLabel={`${labels[m]} mode`}
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
  onModeShortcut,
  submitting,
  inputRef,
  colors
}: {
  draft: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onModeShortcut: (m: Mode) => void;
  submitting: boolean;
  inputRef: React.MutableRefObject<TextInput | null>;
  colors: ThemeColors;
}) {
  const canSubmit = draft.trim().length > 0 && !submitting;
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
        editable={!submitting}
        style={{
          minHeight: 56,
          maxHeight: 140,
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
            onPress={() => onModeShortcut("photo")}
            accessibilityRole="button"
            accessibilityLabel="Switch to photo refine"
          >
            <Ionicons name="camera-outline" size={16} color={colors.ink3} />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={() => onModeShortcut("photo")}
            accessibilityRole="button"
            accessibilityLabel="Switch to photo refine"
          >
            <Ionicons name="image-outline" size={16} color={colors.ink3} />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={() => onModeShortcut("voice")}
            accessibilityRole="button"
            accessibilityLabel="Switch to voice refine"
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
          {submitting ? (
            <ActivityIndicator size="small" color={colors.forestText} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={16}
              color={colors.forestText}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function VoiceInputSurface({
  onRecorded,
  submitting,
  colors
}: {
  onRecorded: (uri: string) => void;
  submitting: boolean;
  colors: ThemeColors;
}) {
  // expo-audio handles permission requests + recording. We track the
  // recording phase locally so the mic button can pulse + the
  // animated waveform can run only while listening.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<"idle" | "recording" | "stopping">(
    "idle"
  );
  const [permissionDenied, setPermissionDenied] = useState(false);
  const autoStoppedRef = useRef(false);

  // Animated waveform bars — decorative, not amplitude-driven. The
  // R20 spec explicitly defers real metering. 24 bars re-randomised
  // every 120 ms reads as alive while staying CPU-cheap.
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 24 }, () => 6)
  );
  useEffect(() => {
    if (phase !== "recording") return;
    const handle = setInterval(() => {
      setBars((prev) =>
        prev.map(() => 4 + Math.floor(Math.random() * 18))
      );
    }, 120);
    return () => clearInterval(handle);
  }, [phase]);

  // Auto-stop guard — backend caps audio at 5 minutes.
  useEffect(() => {
    if (phase !== "recording") {
      autoStoppedRef.current = false;
      return;
    }
    if (
      recorderState.durationMillis >= MAX_RECORD_MS &&
      !autoStoppedRef.current
    ) {
      autoStoppedRef.current = true;
      Alert.alert(
        "Voice notes max 5 minutes",
        "We stopped the recording so it'll fit through the AI."
      );
      void stopAndSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.durationMillis, phase]);

  async function start() {
    if (submitting || phase !== "idle") return;
    try {
      const perm = await AudioModule.getRecordingPermissionsAsync();
      if (!perm.granted) {
        if (perm.canAskAgain === false) {
          setPermissionDenied(true);
          return;
        }
        const next = await AudioModule.requestRecordingPermissionsAsync();
        if (!next.granted) {
          setPermissionDenied(true);
          return;
        }
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPermissionDenied(false);
      setPhase("recording");
    } catch (e) {
      Alert.alert(
        "Couldn't start recording",
        e instanceof Error ? e.message : "Try again."
      );
    }
  }

  async function stopAndSubmit() {
    if (phase !== "recording") return;
    setPhase("stopping");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        Alert.alert("Recording empty", "We couldn't save that recording.");
        setPhase("idle");
        return;
      }
      onRecorded(uri);
    } catch (e) {
      Alert.alert(
        "Couldn't stop recording",
        e instanceof Error ? e.message : "Try again."
      );
    } finally {
      setPhase("idle");
    }
  }

  function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const isRecording = phase === "recording";
  const isStopping = phase === "stopping" || submitting;
  const durationLabel = isRecording
    ? `${formatDuration(recorderState.durationMillis)} · LISTENING`
    : isStopping
      ? submitting
        ? "Sending…"
        : "Stopping…"
      : "Tap to record · Up to 5:00";

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
        onPress={isRecording ? stopAndSubmit : start}
        disabled={isStopping}
        accessibilityRole="button"
        accessibilityLabel={
          isRecording ? "Stop recording" : "Start recording"
        }
        style={{
          width: 68,
          height: 68,
          borderRadius: 99,
          backgroundColor: isRecording ? colors.danger : colors.forest,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: isRecording ? colors.danger : colors.forest,
          shadowOpacity: isRecording ? 0.4 : 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 20,
          elevation: 4,
          opacity: isStopping ? 0.7 : 1
        }}
      >
        {isStopping ? (
          <ActivityIndicator color={colors.forestText} />
        ) : (
          <Ionicons
            name={isRecording ? "stop" : "mic-outline"}
            size={28}
            color={colors.forestText}
          />
        )}
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
              height: isRecording ? h : 6,
              borderRadius: 99,
              backgroundColor: colors.forest,
              opacity: isRecording ? 0.85 - (i % 5) * 0.07 : 0.3
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
        {durationLabel}
      </Text>
      {permissionDenied ? (
        <Pressable
          onPress={() => Linking.openSettings()}
          hitSlop={6}
          style={{ paddingVertical: 4 }}
        >
          <Text
            style={{
              fontFamily: "Geist_500Medium",
              fontSize: 12,
              color: colors.forest,
              textDecorationLine: "underline"
            }}
          >
            Microphone access blocked — open Settings
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PhotoInputSurface({
  onSubmit,
  onError,
  submitting,
  colors
}: {
  onSubmit: (bundle: RefinePhotoBundle) => void;
  onError: (message: string) => void;
  submitting: boolean;
  colors: ThemeColors;
}) {
  const [captured, setCaptured] = useState<RefinePhotoBundle | null>(null);
  const [picking, setPicking] = useState(false);

  async function pick(source: RefinePhotoSource) {
    setPicking(true);
    try {
      const bundle = await pickRefinePhoto(source);
      if (bundle) setCaptured(bundle);
    } catch (e) {
      if (e instanceof RefinePhotoError) {
        onError(e.message);
      } else {
        onError("Couldn't pick a photo. Try again.");
      }
    } finally {
      setPicking(false);
    }
  }

  function openSheet() {
    if (picking || submitting) return;
    // Action sheet via Alert: matches iOS HIG, no custom modal needed.
    // Android renders a 3-button dialog; both surfaces work as
    // expected with the same code path.
    Alert.alert(
      "Snap a change",
      "Pick a photo of a handwritten note, recipe card, or anything else.",
      [
        { text: "Take photo", onPress: () => pick("camera") },
        { text: "Choose from library", onPress: () => pick("library") },
        { text: "Cancel", style: "cancel" }
      ]
    );
  }

  if (captured) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 12,
          gap: 10
        }}
      >
        <View style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
          <Image
            source={{ uri: captured.previewUri }}
            style={{
              width: "100%",
              aspectRatio: 4 / 3,
              backgroundColor: colors.creamSoft
            }}
            resizeMode="cover"
          />
          {submitting ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.35)",
                gap: 8
              }}
            >
              <ActivityIndicator color={colors.forestText} />
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 12,
                  color: colors.forestText,
                  letterSpacing: 0.5,
                  textTransform: "uppercase"
                }}
              >
                Analysing
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => onSubmit(captured)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit photo refinement"
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.forest,
              alignItems: "center",
              opacity: submitting ? 0.7 : 1
            }}
          >
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 14,
                color: colors.forestText
              }}
            >
              {submitting ? "Sending…" : "Submit"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setCaptured(null)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Retake photo"
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              opacity: submitting ? 0.5 : 1
            }}
          >
            <Text
              style={{
                fontFamily: "Geist_500Medium",
                fontSize: 14,
                color: colors.ink2
              }}
            >
              Retake
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={openSheet}
      accessibilityRole="button"
      accessibilityLabel="Snap a change"
      disabled={picking}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: colors.border,
        paddingVertical: 22,
        paddingHorizontal: 16,
        alignItems: "center",
        gap: 6,
        opacity: picking ? 0.7 : 1
      }}
    >
      {picking ? (
        <ActivityIndicator color={colors.forest} />
      ) : (
        <Ionicons name="camera-outline" size={28} color={colors.forest} />
      )}
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

function SessionHistory({
  turns,
  resolverCtx,
  onTogglePress,
  colors
}: {
  turns: RefineTurn[];
  resolverCtx: Parameters<typeof describePendingChange>[1];
  onTogglePress: (turnId: string, currentAccepted: boolean) => void;
  colors: ThemeColors;
}) {
  return (
    <View style={{ marginBottom: 4 }}>
      <SectionLabel
        action={
          <Text
            className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {`${turns.length} turn${turns.length === 1 ? "" : "s"}`}
          </Text>
        }
      >
        This session
      </SectionLabel>
      <View style={{ gap: 14, marginBottom: 18 }}>
        {turns.map((turn) => (
          <TurnBlock
            key={turn.id}
            turn={turn}
            resolverCtx={resolverCtx}
            onTogglePress={onTogglePress}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

function TurnBlock({
  turn,
  resolverCtx,
  onTogglePress,
  colors
}: {
  turn: RefineTurn;
  resolverCtx: Parameters<typeof describePendingChange>[1];
  onTogglePress: (turnId: string, currentAccepted: boolean) => void;
  colors: ThemeColors;
}) {
  const rejected = !turn.accepted;
  return (
    <View style={{ gap: 8 }}>
      <UserBubble source={turn.source} text={turn.prompt} colors={colors} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          rejected
            ? "Accept these changes"
            : "Reject these changes"
        }
        onPress={() => onTogglePress(turn.id, turn.accepted)}
        style={{ opacity: rejected ? 0.55 : 1 }}
      >
        <Card style={{ backgroundColor: colors.paper, padding: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              justifyContent: "space-between"
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={rejected ? "close-circle-outline" : "sparkles-outline"}
                size={14}
                color={rejected ? colors.ink3 : colors.forest}
              />
              <Text
                className="font-mono text-eyebrow uppercase"
                style={{
                  letterSpacing: 1.2,
                  color: rejected ? colors.ink3 : colors.forest
                }}
              >
                {rejected
                  ? `Rejected · ${turn.proposed.length} change${turn.proposed.length === 1 ? "" : "s"}`
                  : `Proposed · ${turn.proposed.length} change${turn.proposed.length === 1 ? "" : "s"}`}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Geist_500Medium",
                fontSize: 11,
                color: colors.ink3,
                letterSpacing: -0.05
              }}
            >
              {rejected ? "Tap to accept" : "Tap to reject"}
            </Text>
          </View>
          {turn.proposed.length === 0 ? (
            <Text
              style={{
                fontFamily: "Geist_400Regular",
                fontSize: 12.5,
                color: colors.ink3,
                fontStyle: "italic"
              }}
            >
              No changes proposed for this turn.
            </Text>
          ) : (
            turn.proposed.map((change: PendingChange) => {
              const d = describePendingChange(change, resolverCtx);
              return (
                <DiffRow
                  key={change.id}
                  kind={change.kind}
                  label={d.title}
                  note={d.typeLabel}
                />
              );
            })
          )}
        </Card>
      </Pressable>
    </View>
  );
}

function UserBubble({
  source,
  text,
  colors
}: {
  source: "text" | "voice" | "photo";
  text: string;
  colors: ThemeColors;
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

