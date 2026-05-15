import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MealLogInput } from "@eeatly/api/validators/meals";
import { MealLogForm } from "../../../components/meal-log-form";
import { VoiceRecorder } from "../../../components/voice-recorder";
import { AudioReadError, readAudioForAi } from "../../../lib/audio-upload";
import { uploadPhoto } from "../../../lib/photo-upload";
import { trpc } from "../../../lib/trpc";

/**
 * Round 15 Task 4 — unified AI capture screen with four input modes:
 * Photo / Text / Voice / YouTube. Replaces the R13 two-mode screen.
 *
 * Mode selector is a horizontal pill strip at the top; tap to switch
 * without losing other modes' input state. (R13 used buttons-as-cards
 * on the Add tab to choose mode; R15 consolidates to a single screen
 * with an in-screen mode switcher.)
 *
 * The handoff suggested implementing this as a "single bottom sheet"
 * from the Add tab. I kept it as a screen — voice recording needs
 * space (132x132 record button + timer + preview), and the existing
 * `calling`/`review` phases already fit the screen-based shape. The
 * Add tab now opens this screen with a default mode; users switch
 * modes inline. Documented as a divergence in the R15 report.
 *
 * All four modes converge on the same review phase, which renders the
 * shared `<MealLogForm>` with `showRecipePreview` and AI-prefilled
 * fields.
 */

type Mode = "photo" | "text" | "voice" | "youtube";

type Phase =
  | { kind: "input" }
  | { kind: "calling"; mode: Mode; longRunning: boolean }
  | { kind: "review"; initial: Partial<MealLogInput> }
  | { kind: "upgrade"; feature: string };

const AI_PHOTO_LONG_EDGE = 1600;

const MODE_LABELS: Record<Mode, string> = {
  photo: "Photo",
  text: "Text",
  voice: "Voice",
  youtube: "YouTube"
};

const MODE_ICONS: Record<Mode, keyof typeof Ionicons.glyphMap> = {
  photo: "camera-outline",
  text: "document-text-outline",
  voice: "mic-outline",
  youtube: "logo-youtube"
};

// Round 7 (web) accepts both `youtube.com/...` and `youtu.be/...` as
// well as `m.youtube.com`. Light client-side check before the round-
// trip; the server re-validates via classifyYoutubeUrl.
const YOUTUBE_HOST_REGEX =
  /^(https?:\/\/)?((www\.|m\.|music\.)?youtube\.com|youtu\.be)\//i;

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

function modeToFeatureLabel(mode: Mode): string {
  switch (mode) {
    case "photo":
      return "photo capture";
    case "text":
      return "text capture";
    case "voice":
      return "voice capture";
    case "youtube":
      return "YouTube capture";
  }
}

export default function AiSuggestScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = (() => {
    const value = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    if (value === "photo" || value === "text" || value === "voice" || value === "youtube") {
      return value;
    }
    return "photo";
  })();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });

  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const voiceMutation = trpc.ai.suggestFromVoice.useMutation();
  const ytMutation = trpc.ai.suggestFromYouTube.useMutation();

  function handleAiError(error: unknown, currentMode: Mode) {
    const reason = getCauseReason(error);
    if (reason === "UPGRADE_REQUIRED") {
      setPhase({ kind: "upgrade", feature: modeToFeatureLabel(currentMode) });
      return;
    }

    // Reuse the typed copy from R7 / R8 web flows where possible — the
    // wire `cause.reason` strings are stable.
    let message: string;
    const fallbackMsg = (error as { message?: string }).message;
    switch (reason) {
      case "RATE_LIMITED":
        message = "Try again in a moment — that's a lot of AI calls in quick succession.";
        break;
      case "INVALID_INPUT":
        message = fallbackMsg ?? "That input isn't supported.";
        break;
      case "AI_PROVIDER_ERROR":
        message = "We couldn't read that. Try again or use a different mode.";
        break;
      // ---- Audio-specific
      case "AUDIO_TOO_LARGE":
        message = "Voice notes max 25 MB. Try a shorter clip.";
        break;
      case "AUDIO_INVALID_FORMAT":
        message = "That audio format isn't supported. Try .m4a or .mp3.";
        break;
      case "AUDIO_TRANSCRIPTION_FAILED":
        message = "We couldn't transcribe that. Try a clearer recording.";
        break;
      case "AUDIO_TOO_SHORT_OR_EMPTY":
        message = "That recording is too short to read. Try a longer note.";
        break;
      // ---- YouTube-specific
      case "YOUTUBE_NO_TRANSCRIPT":
        message =
          "No transcript available for that video. Try a different video or paste the recipe text.";
        break;
      case "YOUTUBE_UNAVAILABLE":
        message = "Video not available. It may have been removed or made private.";
        break;
      case "YOUTUBE_AGE_RESTRICTED":
        message = "Age-restricted videos can't be read by the AI.";
        break;
      case "YOUTUBE_SHORTS_UNSUPPORTED":
        message =
          "YouTube Shorts aren't supported. Use a long-form recipe video instead.";
        break;
      case "YOUTUBE_PLAYLIST_UNSUPPORTED":
        message =
          "Playlists aren't supported. Pick a single video and paste its URL.";
        break;
      case "YOUTUBE_FETCH_FAILED":
        message = "We couldn't reach YouTube. Try again in a moment.";
        break;
      default:
        message = fallbackMsg ?? "Something went wrong. Try again.";
    }
    Alert.alert("AI couldn't help", message);
    setPhase({ kind: "input" });
  }

  function withSlowHintTimer(currentMode: Mode): () => void {
    // Show a "this is taking longer than usual" hint after 5s. Returned
    // function cancels the timer once the call completes.
    setPhase({ kind: "calling", mode: currentMode, longRunning: false });
    const t = setTimeout(() => {
      setPhase((prev) =>
        prev.kind === "calling" && prev.mode === currentMode
          ? { ...prev, longRunning: true }
          : prev
      );
    }, 5_000);
    return () => clearTimeout(t);
  }

  async function runPhoto(localUri: string) {
    const cancelTimer = withSlowHintTimer("photo");
    let prepared: ImageManipulator.ImageResult;
    try {
      prepared = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: AI_PHOTO_LONG_EDGE } }],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );
    } catch {
      cancelTimer();
      Alert.alert(
        "Photo error",
        "Couldn't read that image. Try a different photo."
      );
      setPhase({ kind: "input" });
      return;
    }

    if (!prepared.base64) {
      cancelTimer();
      Alert.alert("Photo error", "Couldn't encode that image. Try again.");
      setPhase({ kind: "input" });
      return;
    }

    const [aiResult, uploadResult] = await Promise.allSettled([
      photoMutation.mutateAsync({
        imageBase64: prepared.base64,
        mediaType: "image/jpeg"
      }),
      uploadPhoto(prepared.uri)
    ]);

    cancelTimer();
    if (aiResult.status === "rejected") {
      handleAiError(aiResult.reason, "photo");
      return;
    }
    const suggestion = aiResult.value;
    const photoUrl =
      uploadResult.status === "fulfilled" ? uploadResult.value.publicUrl : undefined;
    setPhase({
      kind: "review",
      initial: {
        mealName: suggestion.name,
        effortLevel: suggestion.effortGuess,
        notes: suggestion.notes,
        recipeText: suggestion.recipeText,
        ingredients: suggestion.ingredients,
        photoUrl
      }
    });
  }

  async function runText(text: string) {
    const cancelTimer = withSlowHintTimer("text");
    try {
      const suggestion = await textMutation.mutateAsync({ text });
      cancelTimer();
      setPhase({
        kind: "review",
        initial: {
          mealName: suggestion.name,
          effortLevel: suggestion.effortGuess,
          notes: suggestion.notes,
          recipeText: suggestion.recipeText,
          ingredients: suggestion.ingredients
        }
      });
    } catch (error) {
      cancelTimer();
      handleAiError(error, "text");
    }
  }

  async function runVoice(localUri: string, mimeHint?: string | null) {
    const cancelTimer = withSlowHintTimer("voice");
    let bundle;
    try {
      bundle = await readAudioForAi(localUri, mimeHint ?? null);
    } catch (e) {
      cancelTimer();
      if (e instanceof AudioReadError) {
        Alert.alert("Voice note error", e.message);
      } else {
        Alert.alert(
          "Voice note error",
          e instanceof Error ? e.message : "Try again."
        );
      }
      setPhase({ kind: "input" });
      return;
    }

    try {
      const suggestion = await voiceMutation.mutateAsync({
        audioBase64: bundle.audioBase64,
        mediaType: bundle.mediaType as never,
        fileName: bundle.fileName
      });
      cancelTimer();
      setPhase({
        kind: "review",
        initial: {
          mealName: suggestion.name,
          effortLevel: suggestion.effortGuess,
          notes: suggestion.notes,
          recipeText: suggestion.recipeText,
          ingredients: suggestion.ingredients
        }
      });
    } catch (error) {
      cancelTimer();
      handleAiError(error, "voice");
    }
  }

  async function runYouTube(url: string) {
    const cancelTimer = withSlowHintTimer("youtube");
    try {
      const suggestion = await ytMutation.mutateAsync({ url });
      cancelTimer();
      setPhase({
        kind: "review",
        initial: {
          mealName: suggestion.name,
          effortLevel: suggestion.effortGuess,
          notes: suggestion.notes,
          recipeText: suggestion.recipeText,
          ingredients: suggestion.ingredients,
          recipeSourceUrl: url
        }
      });
    } catch (error) {
      cancelTimer();
      handleAiError(error, "youtube");
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Capture with AI", headerBackTitle: "Back" }} />

      {phase.kind === "input" ? (
        <>
          <ModeTabs active={mode} onChange={setMode} />
          {mode === "photo" ? <PhotoInputView onPicked={runPhoto} /> : null}
          {mode === "text" ? <TextInputView onSubmit={runText} /> : null}
          {mode === "voice" ? (
            <VoiceInputView onPicked={runVoice} />
          ) : null}
          {mode === "youtube" ? <YouTubeInputView onSubmit={runYouTube} /> : null}
        </>
      ) : null}

      {phase.kind === "calling" ? (
        <CallingView mode={phase.mode} longRunning={phase.longRunning} />
      ) : null}

      {phase.kind === "upgrade" ? (
        <UpgradeView feature={phase.feature} />
      ) : null}

      {phase.kind === "review" ? (
        <MealLogForm
          initialValues={phase.initial}
          showRecipePreview
          submitSource="quick_log"
          submitLabel="Save this meal"
        />
      ) : null}
    </SafeAreaView>
  );
}

function ModeTabs({
  active,
  onChange
}: {
  active: Mode;
  onChange: (m: Mode) => void;
}) {
  const modes: Mode[] = ["photo", "text", "voice", "youtube"];
  return (
    <View style={styles.tabStrip}>
      {modes.map((m) => {
        const isActive = active === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && !isActive && styles.tabPressed
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={MODE_LABELS[m]}
          >
            <Ionicons
              name={MODE_ICONS[m]}
              size={16}
              color={isActive ? "#fff" : "#2f6f58"}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {MODE_LABELS[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CallingView({
  mode,
  longRunning
}: {
  mode: Mode;
  longRunning: boolean;
}) {
  const heading =
    mode === "voice"
      ? "Listening…"
      : mode === "youtube"
        ? "Reading the video…"
        : mode === "text"
          ? "Reading your text…"
          : "Reading your photo…";
  return (
    <View style={styles.callingWrap}>
      <ActivityIndicator size="large" color="#2f6f58" />
      <Text style={styles.callingTitle}>{heading}</Text>
      <Text style={styles.callingBody}>
        {longRunning
          ? "Voice notes and longer videos take a moment. Stay on this screen — we'll have a draft for you shortly."
          : "This usually takes a few seconds. Stay on this screen."}
      </Text>
    </View>
  );
}

function UpgradeView({ feature }: { feature: string }) {
  return (
    <View style={styles.upgradeWrap}>
      <Ionicons name="sparkles-outline" size={32} color="#2f6f58" />
      <Text style={styles.upgradeTitle}>{feature} is a Plus feature</Text>
      <Text style={styles.upgradeBody}>
        Upgrade on the web to let eeatly extract recipes from photos,
        pasted text, voice notes, or YouTube videos. Manual logging
        stays free.
      </Text>
      <Pressable
        onPress={() => Linking.openURL("https://eeatly.app/pricing")}
        style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}
      >
        <Text style={styles.upgradeButtonText}>See Plus on the web</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={styles.upgradeBack}>Go back</Text>
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------------- */
/* Photo input — camera/library sheet, then hands the local URI back.     */
/* ---------------------------------------------------------------------- */

function PhotoInputView({ onPicked }: { onPicked: (uri: string) => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withPermission(
    request: () => Promise<ImagePicker.PermissionResponse>,
    launch: () => Promise<ImagePicker.ImagePickerResult>,
    name: "Camera" | "Photo library"
  ) {
    setError(null);
    const perm = await request();
    if (!perm.granted) {
      if (perm.canAskAgain === false) {
        Alert.alert(
          `${name} access needed`,
          `eeatly needs ${name.toLowerCase()} access to read your recipe photo. Open Settings?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() }
          ]
        );
      } else {
        setError(`${name} permission denied.`);
      }
      setSheetOpen(false);
      return;
    }
    const result = await launch();
    if (result.canceled || !result.assets[0]) {
      setSheetOpen(false);
      return;
    }
    setSheetOpen(false);
    onPicked(result.assets[0].uri);
  }

  function takePhoto() {
    return withPermission(
      ImagePicker.requestCameraPermissionsAsync,
      () =>
        ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 1
        }),
      "Camera"
    );
  }

  function pickFromLibrary() {
    return withPermission(
      ImagePicker.requestMediaLibraryPermissionsAsync,
      () =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 1
        }),
      "Photo library"
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.inputScroll}>
      <Text style={styles.heading}>Capture a recipe</Text>
      <Text style={styles.body}>
        Snap a recipe card, cookbook page, or finished dish. We'll extract
        the name, recipe text, and ingredients so you can review and save.
      </Text>

      <Pressable
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [styles.bigCta, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="camera-outline" size={28} color="#fff" />
        <Text style={styles.bigCtaText}>Add a photo</Text>
        <Text style={styles.bigCtaHint}>Camera or library</Text>
      </Pressable>

      {error ? <Text style={styles.inlineError}>{error}</Text> : null}

      <View style={styles.tipsBlock}>
        <Tip text="Hold the phone parallel to the page for sharper text." />
        <Tip text="Make sure the whole recipe is in frame." />
        <Tip text="Bright, even light helps the AI read handwriting." />
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => null}>
            <Text style={styles.sheetHeader}>Add a photo</Text>
            <SheetOption icon="camera-outline" label="Take photo" onPress={takePhoto} />
            <SheetOption
              icon="images-outline"
              label="Choose from library"
              onPress={pickFromLibrary}
            />
            <SheetOption
              icon="close-outline"
              label="Cancel"
              variant="cancel"
              onPress={() => setSheetOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

/* ---------------------------------------------------------------------- */
/* Text input — paste a recipe / dish description.                        */
/* ---------------------------------------------------------------------- */

function TextInputView({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 20_000;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.inputScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Paste a recipe</Text>
        <Text style={styles.body}>
          Paste anything you'd cook from — a copied recipe, a description
          of what you made, even a rough note. The AI will turn it into a
          structured meal log you can edit before saving.
        </Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste recipe text, ingredient list, or describe what you cooked…"
          placeholderTextColor="#999"
          multiline
          maxLength={20_000}
          textAlignVertical="top"
          style={styles.textArea}
          autoCorrect
          autoCapitalize="sentences"
        />
        <Text style={styles.charCount}>{trimmed.length} / 20,000</Text>

        <Pressable
          onPress={() => onSubmit(trimmed)}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.bigCta,
            styles.submitCta,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles-outline" size={22} color="#fff" />
          <Text style={styles.bigCtaText}>Extract recipe</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------------------------------------------------------------------- */
/* Voice input — record or pick a file. Both produce a local URI.         */
/* ---------------------------------------------------------------------- */

function VoiceInputView({
  onPicked
}: {
  onPicked: (uri: string, mimeHint?: string | null) => void;
}) {
  const [subMode, setSubMode] = useState<"record" | "upload">("record");
  const [picking, setPicking] = useState(false);

  async function pickFile() {
    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: false,
        copyToCacheDirectory: true
      });
      if (res.canceled || !res.assets[0]) {
        return;
      }
      const asset = res.assets[0];
      onPicked(asset.uri, asset.mimeType ?? null);
    } catch (e) {
      Alert.alert(
        "Couldn't read that file",
        e instanceof Error ? e.message : "Try again."
      );
    } finally {
      setPicking(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.inputScroll}>
      <Text style={styles.heading}>Voice note</Text>
      <Text style={styles.body}>
        Record a quick description, or upload a WhatsApp voice note from
        your library.
      </Text>

      <View style={styles.subModeRow}>
        <Pressable
          onPress={() => setSubMode("record")}
          style={({ pressed }) => [
            styles.subModeTab,
            subMode === "record" && styles.subModeTabActive,
            pressed && subMode !== "record" && styles.tabPressed
          ]}
        >
          <Text
            style={[
              styles.subModeLabel,
              subMode === "record" && styles.subModeLabelActive
            ]}
          >
            Record
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSubMode("upload")}
          style={({ pressed }) => [
            styles.subModeTab,
            subMode === "upload" && styles.subModeTabActive,
            pressed && subMode !== "upload" && styles.tabPressed
          ]}
        >
          <Text
            style={[
              styles.subModeLabel,
              subMode === "upload" && styles.subModeLabelActive
            ]}
          >
            Upload
          </Text>
        </Pressable>
      </View>

      {subMode === "record" ? (
        <VoiceRecorder onRecorded={(uri) => onPicked(uri, "audio/m4a")} />
      ) : (
        <View style={styles.uploadWrap}>
          <Ionicons name="cloud-upload-outline" size={36} color="#2f6f58" />
          <Text style={styles.uploadBody}>
            Pick an audio file from your phone. WhatsApp voice notes, m4a,
            mp3, and wav all work.
          </Text>
          <Pressable
            onPress={pickFile}
            disabled={picking}
            style={({ pressed }) => [
              styles.uploadButton,
              picking && styles.disabled,
              pressed && !picking && styles.pressed
            ]}
            accessibilityRole="button"
          >
            {picking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="folder-open-outline" size={18} color="#fff" />
                <Text style={styles.uploadButtonText}>Choose audio file</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------------- */
/* YouTube input — paste a URL.                                            */
/* ---------------------------------------------------------------------- */

function YouTubeInputView({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const trimmed = url.trim();
  const isValid = YOUTUBE_HOST_REGEX.test(trimmed);
  const showWarning = touched && trimmed.length > 0 && !isValid;
  const canSubmit = isValid;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.inputScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Paste a YouTube link</Text>
        <Text style={styles.body}>
          Long-form recipe videos work best. We'll read the transcript and
          extract the recipe. Shorts and playlists aren't supported.
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          onBlur={() => setTouched(true)}
          placeholder="https://youtube.com/watch?v=…"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="url"
          keyboardType="url"
          textContentType="URL"
          style={styles.urlInput}
        />
        {showWarning ? (
          <Text style={styles.inlineError}>
            That doesn't look like a YouTube link. Use a full URL from the
            video's share menu.
          </Text>
        ) : null}

        <Pressable
          onPress={() => onSubmit(trimmed)}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.bigCta,
            styles.submitCta,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles-outline" size={22} color="#fff" />
          <Text style={styles.bigCtaText}>Read the video</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name="bulb-outline" size={16} color="#888" />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

function SheetOption({
  icon,
  label,
  onPress,
  variant = "default"
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: "default" | "cancel";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetOption,
        pressed && styles.pressed,
        variant === "cancel" && styles.sheetCancel
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={variant === "cancel" ? "#888" : "#2f6f58"}
      />
      <Text
        style={[
          styles.sheetOptionLabel,
          variant === "cancel" && styles.sheetCancelLabel
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  flex: { flex: 1 },
  tabStrip: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#cfe1d7",
    backgroundColor: "#eef5f1"
  },
  tabActive: { backgroundColor: "#2f6f58", borderColor: "#2f6f58" },
  tabPressed: { opacity: 0.85 },
  tabLabel: {
    color: "#1f4a3b",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3
  },
  tabLabelActive: { color: "#fff" },
  inputScroll: {
    padding: 16,
    gap: 14,
    paddingBottom: 48
  },
  heading: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111",
    marginTop: 4
  },
  body: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20
  },
  bigCta: {
    backgroundColor: "#2f6f58",
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  submitCta: {
    minHeight: 56,
    flexDirection: "row",
    gap: 10
  },
  submitDisabled: { backgroundColor: "#a7c6b8" },
  bigCtaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600"
  },
  bigCtaHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  inlineError: {
    color: "#b91c1c",
    fontSize: 13
  },
  tipsBlock: {
    marginTop: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fbfaf6",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    gap: 8
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  tipText: {
    fontSize: 13,
    color: "#555",
    flex: 1
  },
  textArea: {
    minHeight: 220,
    maxHeight: 360,
    borderColor: "#d4d2cb",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#111",
    lineHeight: 21
  },
  charCount: {
    fontSize: 11,
    color: "#888",
    textAlign: "right",
    marginTop: -8
  },
  urlInput: {
    minHeight: 48,
    borderColor: "#d4d2cb",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#111"
  },
  subModeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  subModeTab: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d2cb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  subModeTabActive: { backgroundColor: "#1f4a3b", borderColor: "#1f4a3b" },
  subModeLabel: { color: "#444", fontSize: 13, fontWeight: "500" },
  subModeLabelActive: { color: "#fff" },
  uploadWrap: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    backgroundColor: "#fbfaf6"
  },
  uploadBody: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 19
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#2f6f58",
    alignSelf: "stretch"
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  callingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  callingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111"
  },
  callingBody: {
    fontSize: 13,
    color: "#666",
    textAlign: "center"
  },
  upgradeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
    textAlign: "center"
  },
  upgradeBody: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 20
  },
  upgradeButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    backgroundColor: "#2f6f58",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  upgradeBack: {
    color: "#2f6f58",
    fontSize: 14,
    marginTop: 4
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 4
  },
  sheetHeader: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    paddingVertical: 8
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 8,
    minHeight: 56
  },
  sheetOptionLabel: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500"
  },
  sheetCancel: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    borderRadius: 0,
    paddingTop: 14
  },
  sheetCancelLabel: {
    color: "#666",
    fontWeight: "400"
  }
});
