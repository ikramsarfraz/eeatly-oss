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
  Text,
  TextInput,
  View
} from "react-native";
import type { MealLogInput } from "@eeatly/api/validators/meals";
import { MealLogForm } from "../../../components/meal-log-form";
import { VoiceRecorder } from "../../../components/voice-recorder";
import { AudioReadError, readAudioForAi } from "../../../lib/audio-upload";
import { uploadPhoto } from "../../../lib/photo-upload";
import { trpc } from "../../../lib/trpc";
import {
  Button,
  Card,
  CardBody,
  Input,
  Screen
} from "../../../components/ui";

/**
 * Round 17 — unified AI capture screen, NativeWind rebuild.
 *
 * Three input modes (Photo / Text / Voice) live behind a pill-style
 * segmented control at the top. Each mode renders its own input
 * surface; on success all three converge on the same review phase
 * which mounts <MealLogForm showRecipePreview /> with the AI's
 * structured output.
 *
 * Phase machine — `input` → `calling` → (`review` | `upgrade` |
 * back to `input` on error). The error path always returns to
 * `input` so the user can retry without losing their place.
 */

type Mode = "photo" | "text" | "voice";

type Phase =
  | { kind: "input" }
  | { kind: "calling"; mode: Mode; longRunning: boolean }
  | { kind: "review"; initial: Partial<MealLogInput> }
  | { kind: "upgrade"; feature: string };

const AI_PHOTO_LONG_EDGE = 1600;

const MODE_LABELS: Record<Mode, string> = {
  photo: "Photo",
  text: "Text",
  voice: "Voice"
};

const MODE_ICONS: Record<Mode, keyof typeof Ionicons.glyphMap> = {
  photo: "camera-outline",
  text: "document-text-outline",
  voice: "mic-outline"
};

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

function modeToFeatureLabel(mode: Mode): string {
  switch (mode) {
    case "photo":
      return "Photo capture";
    case "text":
      return "Text capture";
    case "voice":
      return "Voice capture";
  }
}

export default function AiSuggestScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = (() => {
    const value = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    if (value === "photo" || value === "text" || value === "voice") {
      return value;
    }
    return "photo";
  })();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });

  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();
  const voiceMutation = trpc.ai.suggestFromVoice.useMutation();

  function handleAiError(error: unknown, currentMode: Mode) {
    const reason = getCauseReason(error);
    if (reason === "UPGRADE_REQUIRED") {
      setPhase({ kind: "upgrade", feature: modeToFeatureLabel(currentMode) });
      return;
    }
    let message: string;
    const fallbackMsg = (error as { message?: string }).message;
    switch (reason) {
      case "RATE_LIMITED":
        message =
          "Try again in a moment — that's a lot of AI calls in quick succession.";
        break;
      case "INVALID_INPUT":
        message = fallbackMsg ?? "That input isn't supported.";
        break;
      case "AI_PROVIDER_ERROR":
        message = "We couldn't read that. Try again or use a different mode.";
        break;
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
      default:
        message = fallbackMsg ?? "Something went wrong. Try again.";
    }
    Alert.alert("AI couldn't help", message);
    setPhase({ kind: "input" });
  }

  function withSlowHintTimer(currentMode: Mode): () => void {
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
      uploadResult.status === "fulfilled"
        ? uploadResult.value.publicUrl
        : undefined;
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

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Capture with AI",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FBF8F1" },
          headerTintColor: "#1A1F1B",
          headerTitleStyle: { fontWeight: "600" }
        }}
      />

      {phase.kind === "input" ? (
        <>
          <ModeTabs active={mode} onChange={setMode} />
          {mode === "photo" ? <PhotoInputView onPicked={runPhoto} /> : null}
          {mode === "text" ? <TextInputView onSubmit={runText} /> : null}
          {mode === "voice" ? <VoiceInputView onPicked={runVoice} /> : null}
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
    </Screen>
  );
}

function ModeTabs({
  active,
  onChange
}: {
  active: Mode;
  onChange: (m: Mode) => void;
}) {
  const modes: Mode[] = ["photo", "text", "voice"];
  return (
    <View className="flex-row gap-1.5 px-4 py-3 border-b border-border bg-background">
      {modes.map((m) => {
        const isActive = active === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={MODE_LABELS[m]}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-pill h-11 active:opacity-90 ${
              isActive
                ? "bg-primary"
                : "bg-background-elevated border border-border"
            }`}
          >
            <Ionicons
              name={MODE_ICONS[m]}
              size={16}
              color={isActive ? "#FBF8F1" : "#2C5F3F"}
            />
            <Text
              className={`text-caption-strong font-semibold ${
                isActive ? "text-primary-foreground" : "text-foreground"
              }`}
            >
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
      : mode === "text"
        ? "Reading your text…"
        : "Reading your photo…";
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <ActivityIndicator size="large" color="#2C5F3F" />
      <Text className="text-heading-2 font-semibold text-foreground text-center">
        {heading}
      </Text>
      <Text className="text-body text-foreground-muted text-center max-w-[280px]">
        {longRunning
          ? "Voice notes and longer transcripts take a moment. Stay on this screen — we'll have a draft for you shortly."
          : "This usually takes a few seconds. Stay on this screen."}
      </Text>
    </View>
  );
}

function UpgradeView({ feature }: { feature: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
        <Ionicons name="sparkles-outline" size={28} color="#1A1F1B" />
      </View>
      <Text className="text-heading-2 font-semibold text-foreground text-center">
        {feature} is part of eeatly Plus
      </Text>
      <Text className="text-body text-foreground-muted text-center max-w-[300px]">
        Upgrade on the web to let eeatly extract recipes from photos,
        pasted text, or voice notes. Manual logging stays free.
      </Text>
      <View className="mt-2 gap-2">
        <Button
          variant="primary"
          size="lg"
          onPress={() => Linking.openURL("https://eeatly.app/pricing")}
        >
          See Plus on the web
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          Go back
        </Button>
      </View>
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
    <ScrollView contentContainerClassName="p-4 pb-12 gap-4">
      <View className="gap-1.5">
        <Text className="text-heading-2 font-semibold text-foreground">
          Capture a recipe
        </Text>
        <Text className="text-body text-foreground-muted">
          Snap a recipe card, cookbook page, or finished dish. We'll
          extract the name, recipe text, and ingredients so you can
          review before saving.
        </Text>
      </View>

      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        className="bg-primary rounded-md py-6 px-5 items-center justify-center gap-1.5 active:opacity-90 shadow-sm"
      >
        <Ionicons name="camera-outline" size={32} color="#FBF8F1" />
        <Text className="text-heading-3 font-semibold text-primary-foreground">
          Add a photo
        </Text>
        <Text className="text-caption text-primary-foreground/80">
          Camera or library
        </Text>
      </Pressable>

      {error ? (
        <Text className="text-caption text-destructive">{error}</Text>
      ) : null}

      <Card>
        <CardBody>
          <View className="gap-2.5">
            <Tip text="Hold the phone parallel to the page for sharper text." />
            <Tip text="Make sure the whole recipe is in frame." />
            <Tip text="Bright, even light helps the AI read handwriting." />
          </View>
        </CardBody>
      </Card>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          className="flex-1 bg-foreground/40 justify-end"
          onPress={() => setSheetOpen(false)}
        >
          <Pressable
            onPress={() => null}
            className="bg-background-elevated rounded-t-lg pt-3 pb-9 px-4 gap-1"
          >
            <Text className="text-caption text-foreground-muted text-center py-2">
              Add a photo
            </Text>
            <SheetOption
              icon="camera-outline"
              label="Take photo"
              onPress={takePhoto}
            />
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
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerClassName="p-4 pb-12 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1.5">
          <Text className="text-heading-2 font-semibold text-foreground">
            Paste a recipe
          </Text>
          <Text className="text-body text-foreground-muted">
            Paste anything you'd cook from — a copied recipe, a description
            of what you made, even a rough note. The AI will turn it into a
            structured meal log you can edit before saving.
          </Text>
        </View>

        <Input
          value={text}
          onChangeText={setText}
          placeholder="Paste recipe text, ingredient list, or describe what you cooked…"
          multiline
          maxLength={20_000}
          autoCorrect
          autoCapitalize="sentences"
        />
        <Text className="text-small text-foreground-muted text-right -mt-2">
          {trimmed.length} / 20,000
        </Text>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          leadingIcon={
            <Ionicons name="sparkles-outline" size={18} color="#FBF8F1" />
          }
          onPress={() => onSubmit(trimmed)}
        >
          Extract recipe
        </Button>
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
    <ScrollView contentContainerClassName="p-4 pb-12 gap-4">
      <View className="gap-1.5">
        <Text className="text-heading-2 font-semibold text-foreground">
          Voice note
        </Text>
        <Text className="text-body text-foreground-muted">
          Record a quick description, or upload a WhatsApp voice note from
          your library.
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => setSubMode("record")}
          className={`flex-1 h-11 rounded-md items-center justify-center border ${
            subMode === "record"
              ? "bg-foreground border-foreground"
              : "border-border bg-background-elevated active:bg-background-muted"
          }`}
        >
          <Text
            className={`text-caption-strong font-semibold ${
              subMode === "record" ? "text-background" : "text-foreground"
            }`}
          >
            Record
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSubMode("upload")}
          className={`flex-1 h-11 rounded-md items-center justify-center border ${
            subMode === "upload"
              ? "bg-foreground border-foreground"
              : "border-border bg-background-elevated active:bg-background-muted"
          }`}
        >
          <Text
            className={`text-caption-strong font-semibold ${
              subMode === "upload" ? "text-background" : "text-foreground"
            }`}
          >
            Upload
          </Text>
        </Pressable>
      </View>

      {subMode === "record" ? (
        <VoiceRecorder onRecorded={(uri) => onPicked(uri, "audio/m4a")} />
      ) : (
        <Card>
          <CardBody>
            <View className="items-center gap-3 py-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-muted">
                <Ionicons
                  name="cloud-upload-outline"
                  size={28}
                  color="#2C5F3F"
                />
              </View>
              <Text className="text-body text-foreground-muted text-center max-w-[280px]">
                Pick an audio file from your phone. WhatsApp voice notes,
                m4a, mp3, and wav all work.
              </Text>
              <Button
                variant="primary"
                size="md"
                loading={picking}
                disabled={picking}
                leadingIcon={
                  <Ionicons
                    name="folder-open-outline"
                    size={18}
                    color="#FBF8F1"
                  />
                }
                onPress={pickFile}
              >
                Choose audio file
              </Button>
            </View>
          </CardBody>
        </Card>
      )}
    </ScrollView>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Ionicons name="bulb-outline" size={16} color="#6B7068" />
      <Text className="text-caption text-foreground-muted flex-1">{text}</Text>
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
      className={`flex-row items-center gap-3.5 px-2 py-3.5 rounded-sm min-h-[56px] active:opacity-70 ${
        variant === "cancel" ? "mt-1 border-t border-border" : ""
      }`}
    >
      <Ionicons
        name={icon}
        size={22}
        color={variant === "cancel" ? "#6B7068" : "#2C5F3F"}
      />
      <Text
        className={`text-body ${
          variant === "cancel"
            ? "text-foreground-muted"
            : "text-foreground font-semibold"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

