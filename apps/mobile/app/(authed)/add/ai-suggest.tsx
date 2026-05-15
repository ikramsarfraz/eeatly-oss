import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
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
import { uploadPhoto } from "../../../lib/photo-upload";
import { trpc } from "../../../lib/trpc";

/**
 * Round 13 Task 4 — AI capture. Two entry modes via `?mode=`:
 *
 *   - `photo`  Snap or pick a recipe / dish photo. Resize + JPEG-encode
 *              locally (ImageManipulator), then ship the base64 bytes
 *              to `ai.suggestFromPhoto`. In parallel, upload the same
 *              JPEG to R2 via `uploadPhoto` so the eventual log has a
 *              persisted photo URL — the AI call uses base64 (transient)
 *              and R2 upload feeds the saved meal (persisted). Per R11
 *              the AI endpoint deliberately does NOT take an R2 URL.
 *
 *   - `text`   Paste a recipe / dish description. Send to
 *              `ai.suggestFromText` and hand the result to the review
 *              form. No R2 upload happens on this path.
 *
 * After the AI returns a suggestion, the screen flips to the shared
 * `<MealLogForm>` (same one Task 3 uses) with the AI fields prefilled
 * and a read-only "What the AI read" preview block above the form.
 *
 * Errors map structured `cause.reason`:
 *   - UPGRADE_REQUIRED → inline upgrade card (free users)
 *   - RATE_LIMITED     → Alert + return to input
 *   - INVALID_INPUT    → Alert with copy from server
 *   - AI_PROVIDER_ERROR → Alert "couldn't read that" + return to input
 */

type Phase =
  | { kind: "input" }
  | { kind: "calling" }
  | { kind: "review"; initial: Partial<MealLogInput> }
  | { kind: "upgrade" };

/** Width clamp for the JPEG we send to the AI. Smaller than the persisted
 * upload (2048) because base64-encoding inflates wire size 33% and the
 * vision model doesn't need full-res to read a recipe card. */
const AI_PHOTO_LONG_EDGE = 1600;

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export default function AiSuggestScreen() {
  const { mode } = useLocalSearchParams<{ mode?: "photo" | "text" }>();
  const isText = mode === "text";
  const title = isText ? "Capture from text" : "Capture from photo";
  const [phase, setPhase] = useState<Phase>({ kind: "input" });

  const photoMutation = trpc.ai.suggestFromPhoto.useMutation();
  const textMutation = trpc.ai.suggestFromText.useMutation();

  function handleAiError(error: unknown) {
    const reason = getCauseReason(error);
    if (reason === "UPGRADE_REQUIRED") {
      setPhase({ kind: "upgrade" });
      return;
    }
    const message =
      reason === "RATE_LIMITED"
        ? "Try again in a moment — that's a lot of AI calls in quick succession."
        : reason === "INVALID_INPUT"
          ? (error as { message?: string }).message ?? "That input isn't supported."
          : reason === "AI_PROVIDER_ERROR"
            ? "We couldn't read that. Try a clearer photo or a longer description."
            : (error as { message?: string }).message ?? "Something went wrong. Try again.";
    Alert.alert("AI couldn't help", message);
    setPhase({ kind: "input" });
  }

  async function runPhoto(localUri: string) {
    setPhase({ kind: "calling" });
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
      Alert.alert(
        "Photo error",
        "Couldn't read that image. Try a different photo."
      );
      setPhase({ kind: "input" });
      return;
    }

    if (!prepared.base64) {
      Alert.alert("Photo error", "Couldn't encode that image. Try again.");
      setPhase({ kind: "input" });
      return;
    }

    // Run AI + persistence upload concurrently. If the R2 upload fails
    // (no R2 configured, network blip), the review still opens with the
    // AI suggestion — just without a photo attached. AI failure does
    // abort the whole flow, since there's nothing to review without it.
    const [aiResult, uploadResult] = await Promise.allSettled([
      photoMutation.mutateAsync({
        imageBase64: prepared.base64,
        mediaType: "image/jpeg"
      }),
      uploadPhoto(prepared.uri)
    ]);

    if (aiResult.status === "rejected") {
      handleAiError(aiResult.reason);
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
    setPhase({ kind: "calling" });
    try {
      const suggestion = await textMutation.mutateAsync({ text });
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
      handleAiError(error);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title, headerBackTitle: "Back" }} />

      {phase.kind === "input" && !isText ? (
        <PhotoInputView onPicked={runPhoto} />
      ) : null}
      {phase.kind === "input" && isText ? (
        <TextInputView onSubmit={runText} />
      ) : null}
      {phase.kind === "calling" ? <CallingView isText={isText} /> : null}
      {phase.kind === "upgrade" ? <UpgradeView isText={isText} /> : null}
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

function CallingView({ isText }: { isText: boolean }) {
  return (
    <View style={styles.callingWrap}>
      <ActivityIndicator size="large" color="#2f6f58" />
      <Text style={styles.callingTitle}>Reading your {isText ? "text" : "photo"}…</Text>
      <Text style={styles.callingBody}>
        This usually takes a few seconds. Stay on this screen.
      </Text>
    </View>
  );
}

function UpgradeView({ isText }: { isText: boolean }) {
  const feature = isText ? "text capture" : "photo capture";
  return (
    <View style={styles.upgradeWrap}>
      <Ionicons name="sparkles-outline" size={32} color="#2f6f58" />
      <Text style={styles.upgradeTitle}>{feature} is a Plus feature</Text>
      <Text style={styles.upgradeBody}>
        Upgrade on the web to let eeatly extract recipes from photos and
        pasted text. Manual logging stays free.
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
        style={({ pressed }) => [
          styles.bigCta,
          pressed && styles.pressed
        ]}
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
            <Text style={styles.sheetTitle}>Add a photo</Text>
            <SheetOption icon="camera-outline" label="Take photo" onPress={takePhoto} />
            <SheetOption icon="images-outline" label="Choose from library" onPress={pickFromLibrary} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  flex: { flex: 1 },
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
  submitDisabled: {
    backgroundColor: "#a7c6b8"
  },
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
  sheetTitle: {
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
