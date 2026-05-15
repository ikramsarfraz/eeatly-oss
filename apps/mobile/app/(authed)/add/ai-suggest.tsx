import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import type { MealLogInput } from "@eeatly/api/validators/meals";
import { MealLogForm } from "../../../components/meal-log-form";
import { TopNav } from "../../../components/top-nav";
import { VoiceRecorder } from "../../../components/voice-recorder";
import { AudioReadError, readAudioForAi } from "../../../lib/audio-upload";
import { uploadPhoto } from "../../../lib/photo-upload";
import { colors } from "../../../lib/design/tokens";
import { trpc } from "../../../lib/trpc";
import {
  Button,
  Card,
  CardBody,
  Input,
  PageTitle,
  Screen
} from "../../../components/ui";

/**
 * Round 18 — unified AI capture screen, editorial rebuild.
 *
 * Mode toggle (Photo / Text / Voice) lives in a 3-equal-flex pill row.
 * Each mode renders its own input surface; on success all three
 * converge on the review phase which mounts <MealLogForm
 * showRecipePreview /> with the extracted draft.
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
    <Screen edges={["top", "bottom"]}>
      <TopNav title="Capture with AI" back showSettings={false} />

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
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: 4
      }}
    >
      {modes.map((m) => {
        const isActive = active === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={MODE_LABELS[m]}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              borderRadius: 99,
              paddingVertical: 11,
              backgroundColor: isActive ? colors.forest : colors.surface,
              borderWidth: isActive ? 0 : 1,
              borderColor: colors.border
            }}
          >
            <Ionicons
              name={MODE_ICONS[m]}
              size={16}
              color={isActive ? colors.forestText : colors.ink2}
            />
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 13.5,
                color: isActive ? colors.forestText : colors.ink2,
                letterSpacing: -0.1
              }}
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
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        gap: 12
      }}
    >
      <ActivityIndicator size="large" color={colors.forest} />
      <Text
        className="font-display text-display-xs text-ink text-center"
        style={{ letterSpacing: -0.4 }}
      >
        {heading}
      </Text>
      <Text className="font-body text-body-lg text-ink-2 text-center max-w-[280px]">
        {longRunning
          ? "Voice notes and longer transcripts take a moment. Stay on this screen — we'll have a draft for you shortly."
          : "This usually takes a few seconds. Stay on this screen."}
      </Text>
    </View>
  );
}

function UpgradeView({ feature }: { feature: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        gap: 12
      }}
    >
      <View
        style={{
          height: 56,
          width: 56,
          borderRadius: 99,
          backgroundColor: colors.wheat,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Ionicons name="sparkles-outline" size={26} color={colors.ink} />
      </View>
      <Text
        className="font-display text-display-xs text-ink text-center"
        style={{ letterSpacing: -0.4 }}
      >
        {feature} is part of eeatly Plus
      </Text>
      <Text className="font-body text-body-lg text-ink-2 text-center max-w-[300px]">
        Upgrade on the web to let eeatly extract recipes from photos,
        pasted text, or voice notes. Manual logging stays free.
      </Text>
      <View style={{ marginTop: 8, gap: 10, alignSelf: "stretch", paddingHorizontal: 30 }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => Linking.openURL("https://eeatly.app/pricing")}
        >
          See Plus on the web
        </Button>
        <Button variant="ghost" fullWidth onPress={() => router.back()}>
          Go back
        </Button>
      </View>
    </View>
  );
}

/* ─── Photo input ─────────────────────────────────────────────── */

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
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 32,
        gap: 18
      }}
    >
      <PageTitle
        title="Capture a recipe."
        size="sm"
        subtitle="Snap a recipe card, cookbook page, or finished dish. We'll lift the name, ingredients, and steps — then you review before saving."
      />

      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        style={{
          backgroundColor: colors.forest,
          borderRadius: 18,
          paddingVertical: 32,
          paddingHorizontal: 24,
          alignItems: "center",
          shadowColor: colors.forest,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 20,
          elevation: 4
        }}
        className="active:opacity-90"
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 99,
            backgroundColor: "rgba(245,239,226,0.18)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14
          }}
        >
          <Ionicons name="camera-outline" size={28} color={colors.forestText} />
        </View>
        <Text
          style={{
            fontFamily: "InstrumentSerif_400Regular",
            fontSize: 28,
            color: colors.forestText,
            letterSpacing: -0.4,
            marginBottom: 6
          }}
        >
          Add a photo
        </Text>
        <Text
          style={{
            fontFamily: "JetBrainsMono_500Medium",
            fontSize: 11,
            color: colors.forestText,
            opacity: 0.75,
            letterSpacing: 1.2,
            textTransform: "uppercase"
          }}
        >
          Camera · library
        </Text>
      </Pressable>

      {error ? (
        <Text className="font-body text-body-md text-danger">{error}</Text>
      ) : null}

      <Card>
        <CardBody>
          <Text
            className="font-body-semibold text-label text-ink-3 uppercase mb-2.5"
            style={{ letterSpacing: 1.4 }}
          >
            For sharper results
          </Text>
          <Tip text="Hold the phone parallel to the page." />
          <Tip text="Make sure the whole recipe is in frame." />
          <Tip text="Bright, even light helps with handwriting." />
        </CardBody>
      </Card>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(20,20,15,0.32)",
            justifyContent: "flex-end"
          }}
          onPress={() => setSheetOpen(false)}
        >
          <Pressable
            onPress={() => null}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingTop: 12,
              paddingBottom: 36,
              paddingHorizontal: 16
            }}
          >
            <Text
              className="font-mono text-eyebrow text-ink-3 uppercase text-center py-2"
              style={{ letterSpacing: 1.2 }}
            >
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

/* ─── Text input ──────────────────────────────────────────────── */

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
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 18,
          paddingBottom: 32,
          gap: 18
        }}
        keyboardShouldPersistTaps="handled"
      >
        <PageTitle
          title="Paste a recipe."
          size="sm"
          subtitle="Paste anything you'd cook from — a recipe, a description of what you made, even a rough note. We'll turn it into a structured meal log you can edit before saving."
        />

        <Input
          value={text}
          onChangeText={setText}
          placeholder="Paste recipe text, ingredient list, or describe what you cooked…"
          multiline
          maxLength={20_000}
          autoCorrect
          autoCapitalize="sentences"
        />
        <Text
          className="font-mono text-eyebrow text-ink-3 text-right -mt-2"
          style={{ letterSpacing: 0.5 }}
        >
          {trimmed.length} / 20,000
        </Text>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          leadingIcon={
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={colors.forestText}
            />
          }
          onPress={() => onSubmit(trimmed)}
        >
          Extract recipe
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Voice input ─────────────────────────────────────────────── */

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
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 32,
        gap: 18
      }}
    >
      <PageTitle
        title="Voice note."
        size="sm"
        subtitle="Record a quick description, or upload a WhatsApp voice note from your library."
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { id: "record", label: "Record" },
          { id: "upload", label: "Upload" }
        ].map((opt) => {
          const on = subMode === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setSubMode(opt.id as "record" | "upload")}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 99,
                backgroundColor: on ? colors.forest : colors.surface,
                borderWidth: on ? 0 : 1,
                borderColor: colors.border,
                alignItems: "center"
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 13.5,
                  color: on ? colors.forestText : colors.ink2,
                  letterSpacing: -0.1
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {subMode === "record" ? (
        <VoiceRecorder onRecorded={(uri) => onPicked(uri, "audio/m4a")} />
      ) : (
        <Card>
          <CardBody>
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 16 }}>
              <View
                style={{
                  height: 56,
                  width: 56,
                  borderRadius: 99,
                  backgroundColor: colors.sageBg,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={28}
                  color={colors.forest}
                />
              </View>
              <Text className="font-body text-body-lg text-ink-2 text-center max-w-[280px]">
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
                    color={colors.forestText}
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
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
        paddingVertical: 8
      }}
    >
      <Ionicons name="bulb-outline" size={16} color={colors.forest} />
      <Text className="font-body text-body-sm text-ink flex-1" style={{ lineHeight: 20 }}>
        {text}
      </Text>
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
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 8,
        paddingVertical: 14,
        borderRadius: 12,
        minHeight: 56,
        marginTop: variant === "cancel" ? 4 : 0,
        borderTopWidth: variant === "cancel" ? 1 : 0,
        borderTopColor: colors.borderSoft
      }}
      className="active:opacity-70"
    >
      <Ionicons
        name={icon}
        size={22}
        color={variant === "cancel" ? colors.ink2 : colors.forest}
      />
      <Text
        style={{
          fontFamily:
            variant === "cancel" ? "Geist_500Medium" : "Geist_600SemiBold",
          fontSize: 15,
          color: variant === "cancel" ? colors.ink2 : colors.ink
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
