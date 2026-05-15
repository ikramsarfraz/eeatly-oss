import { useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { mealLogInputSchema } from "@eeatly/api/validators/meals";
import type { MealLogInput } from "@eeatly/api/validators/meals";
import { trpc } from "../lib/trpc";
import { PhotoPicker } from "./photo-picker";
import { SourceUrlInputPreview } from "./embeds/source-url-input-preview";

/**
 * Round 13 — shared meal log form. Two callers:
 *   - `/add/log` (Task 3): plain manual log, autocompletes against the
 *     household library, no recipe preview.
 *   - `/add/ai-suggest` (Task 4): review-and-edit after the AI returns a
 *     suggestion. Recipe text + extracted ingredients show as a read-only
 *     preview block above the fields; the user can still tweak name/
 *     effort/notes/photo before saving.
 *
 * Submit funnels through `meals.createLog` either way; the server's
 * `(householdId, normalizedName)` idempotency means typing an existing
 * name (or AI guessing one) produces a re-cook log, not a duplicate meal.
 */

type EffortValue = MealLogInput["effortLevel"];

const EFFORT_OPTIONS: Array<{ value: EffortValue; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High" }
];

/** Format a Date as `YYYY-MM-DD` using local components, not UTC. */
function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  });
}

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export type MealLogFormProps = {
  /** Pre-fill any subset of fields. The AI review path fills name/effort/notes/recipeText/ingredients. */
  initialValues?: Partial<MealLogInput>;
  /** Show a read-only preview block (recipe + ingredients) above the fields. AI flow only. */
  showRecipePreview?: boolean;
  /** Funnel telemetry — distinguishes a fresh log from an AI-driven one. Defaults to "quick_log". */
  submitSource?: "quick_log" | "log_again";
  /** Hide the meal-name autocomplete (AI flow already gave us a name). */
  hideAutocomplete?: boolean;
  /** Label for the submit button. Defaults to "Save meal log". */
  submitLabel?: string;
};

export function MealLogForm({
  initialValues,
  showRecipePreview,
  submitSource = "quick_log",
  hideAutocomplete,
  submitLabel = "Save meal log"
}: MealLogFormProps) {
  const utils = trpc.useUtils();

  const [mealName, setMealName] = useState(initialValues?.mealName ?? "");
  const [cookedDate, setCookedDate] = useState<string>(
    initialValues?.cookedDate || formatYMD(new Date())
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initialValues?.photoUrl || null
  );
  const [effort, setEffort] = useState<EffortValue>(
    initialValues?.effortLevel ?? "easy"
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Recipe / ingredients ride through invisibly when the AI prefilled
  // them. No UI field to edit them on mobile (matches Task 3's "keep the
  // form small" cap) — but the values still post on submit so the recipe
  // view renders them properly.
  const recipeText = initialValues?.recipeText ?? "";
  const ingredients = initialValues?.ingredients;

  // Round 16 — Source URL is now an editable field. Users paste recipe
  // links (YouTube, TikTok, blog posts) here; the saved meal renders the
  // embedded media or an OG preview card on the detail screen.
  const [recipeSourceUrl, setRecipeSourceUrl] = useState(
    initialValues?.recipeSourceUrl ?? ""
  );

  const [debouncedName, setDebouncedName] = useState("");
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideAutocomplete) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedName(mealName.trim());
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mealName, hideAutocomplete]);

  const searchQuery = trpc.search.meals.useQuery(
    { q: debouncedName, limit: 5 },
    {
      enabled:
        !hideAutocomplete && debouncedName.length >= 2 && !suggestionsHidden,
      staleTime: 30_000
    }
  );

  const suggestions = useMemo(() => {
    if (hideAutocomplete) return [];
    const data = searchQuery.data ?? [];
    const lower = mealName.trim().toLowerCase();
    return data.filter((m) => m.name.trim().toLowerCase() !== lower).slice(0, 5);
  }, [searchQuery.data, mealName, hideAutocomplete]);

  const createLog = trpc.meals.createLog.useMutation({
    onSuccess: async () => {
      await utils.dashboard.meals.invalidate();
      await utils.search.meals.invalidate();
      router.replace("/(authed)/home");
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      const message =
        reason === "RATE_LIMITED"
          ? "Slow down a moment — try again shortly."
          : reason === "UNAUTHENTICATED"
            ? "Your session expired. Sign in again to keep logging."
            : reason === "MEAL_ARCHIVED"
              ? "That meal was archived. Use a slightly different name to log it again."
              : error.message || "Couldn't save that log. Try again.";
      Alert.alert("Couldn't save", message);
    }
  });

  function handleSelectSuggestion(name: string) {
    setMealName(name);
    setSuggestionsHidden(true);
    setNameError(null);
  }

  function handleSubmit() {
    setNameError(null);
    const payload: MealLogInput = {
      mealName: mealName.trim(),
      effortLevel: effort,
      cookedDate,
      notes: notes.trim() || undefined,
      photoUrl: photoUrl ?? undefined,
      recipeText: recipeText || undefined,
      recipeSourceUrl: recipeSourceUrl.trim() || undefined,
      ingredients: ingredients && ingredients.length > 0 ? ingredients : undefined
    };
    const parsed = mealLogInputSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const onName = issue?.path?.[0] === "mealName";
      const msg = issue?.message ?? "Check the form and try again.";
      if (onName) setNameError(msg);
      else Alert.alert("Check the form", msg);
      return;
    }
    createLog.mutate({ log: parsed.data, source: submitSource });
  }

  const submitting = createLog.isPending;
  const canSubmit = mealName.trim().length >= 2 && !submitting;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {showRecipePreview && (recipeText || (ingredients?.length ?? 0) > 0) ? (
          <View style={styles.recipePreview}>
            <View style={styles.recipePreviewHeader}>
              <Ionicons name="sparkles-outline" size={16} color="#2f6f58" />
              <Text style={styles.recipePreviewTitle}>What the AI read</Text>
            </View>
            {ingredients && ingredients.length > 0 ? (
              <View style={styles.ingredientsBlock}>
                <Text style={styles.ingredientsHeading}>Ingredients</Text>
                {ingredients.map((line, i) => (
                  <Text key={`${line}-${i}`} style={styles.ingredientLine}>
                    • {line}
                  </Text>
                ))}
              </View>
            ) : null}
            {recipeText ? (
              <View style={styles.recipeTextBlock}>
                <Text style={styles.ingredientsHeading}>Recipe</Text>
                <Text style={styles.recipeText}>{recipeText}</Text>
              </View>
            ) : null}
            <Text style={styles.recipePreviewHint}>
              Saved as-is when you tap save. Edit the name, photo, or effort
              below if the AI got something off.
            </Text>
          </View>
        ) : null}

        <Field label="Meal name" required>
          <TextInput
            value={mealName}
            onChangeText={(t) => {
              setMealName(t);
              setSuggestionsHidden(false);
              if (nameError) setNameError(null);
            }}
            placeholder="What did you cook?"
            placeholderTextColor="#999"
            style={styles.input}
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="next"
            editable={!submitting}
          />
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
          {suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => handleSelectSuggestion(s.name)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed && styles.suggestionPressed
                  ]}
                >
                  <Ionicons name="restaurant-outline" size={16} color="#2f6f58" />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.suggestionHint}>Log again</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Field>

        <Field label="When did you cook this?">
          <Pressable
            onPress={() => setShowDatePicker(true)}
            disabled={submitting}
            style={({ pressed }) => [
              styles.input,
              styles.dateButton,
              pressed && styles.pressed,
              submitting && styles.disabled
            ]}
          >
            <Text style={styles.dateText}>{formatDateLabel(cookedDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </Pressable>
        </Field>

        <Field label="Photo">
          <PhotoPicker
            value={photoUrl}
            onChange={setPhotoUrl}
            disabled={submitting}
          />
        </Field>

        <Field label="Effort">
          <View style={styles.segmented}>
            {EFFORT_OPTIONS.map((opt, idx) => {
              const active = effort === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setEffort(opt.value)}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.segment,
                    idx > 0 && styles.segmentDivider,
                    active && styles.segmentActive,
                    pressed && !active && styles.segmentPressed
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      active && styles.segmentLabelActive
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Notes" hint="What worked, what to change next time. Optional.">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Doubled the garlic, used chicken stock instead of water…"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
            style={[styles.input, styles.notesInput]}
            editable={!submitting}
          />
        </Field>

        <Field
          label="Source URL"
          hint="YouTube, TikTok, Pinterest, or any recipe link. Optional."
        >
          <TextInput
            value={recipeSourceUrl}
            onChangeText={setRecipeSourceUrl}
            placeholder="https://youtube.com/…"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="url"
            keyboardType="url"
            textContentType="URL"
            style={styles.input}
            editable={!submitting}
          />
          <SourceUrlInputPreview url={recipeSourceUrl} />
        </Field>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.submitPressed
          ]}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{submitLabel}</Text>
          )}
        </Pressable>
      </ScrollView>

      {showDatePicker ? (
        <DatePickerSheet
          value={cookedDate}
          onConfirm={(next) => {
            setCookedDate(next);
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Native date picker wrapped in a bottom sheet so Android (modal dialog)
 * and iOS (inline spinner) both feel platform-native.
 */
function DatePickerSheet({
  value,
  onConfirm,
  onCancel
}: {
  value: string;
  onConfirm: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Date>(() => {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  });

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={draft}
        mode="date"
        display="default"
        maximumDate={new Date()}
        onChange={(event, next) => {
          if (event.type === "set" && next) {
            onConfirm(formatYMD(next));
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => null}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>When did you cook this?</Text>
            <Pressable onPress={() => onConfirm(formatYMD(draft))} hitSlop={12}>
              <Text style={styles.sheetDone}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={(_, next) => {
              if (next) setDraft(next);
            }}
            style={styles.iosPicker}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 48
  },
  field: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    letterSpacing: 0.2
  },
  required: { color: "#b91c1c" },
  hint: { fontSize: 12, color: "#777", marginBottom: 2 },
  input: {
    minHeight: 48,
    borderColor: "#d4d2cb",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111"
  },
  notesInput: {
    minHeight: 96
  },
  fieldError: { color: "#b91c1c", fontSize: 12 },
  suggestions: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 44
  },
  suggestionPressed: { backgroundColor: "#f3f1ea" },
  suggestionText: { flex: 1, fontSize: 15, color: "#111" },
  suggestionHint: { fontSize: 11, color: "#2f6f58", fontWeight: "500" },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12
  },
  dateText: { fontSize: 16, color: "#111" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4d2cb",
    overflow: "hidden",
    backgroundColor: "#fff"
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  segmentDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: "#d4d2cb"
  },
  segmentActive: {
    backgroundColor: "#2f6f58"
  },
  segmentPressed: {
    backgroundColor: "#eef2ef"
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333"
  },
  segmentLabelActive: {
    color: "#fff"
  },
  submitButton: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center"
  },
  submitPressed: { opacity: 0.85 },
  submitDisabled: { backgroundColor: "#a7c6b8" },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  recipePreview: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#eef5f1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cfe1d7",
    gap: 10
  },
  recipePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  recipePreviewTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2f6f58",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  ingredientsBlock: { gap: 2 },
  recipeTextBlock: { gap: 2 },
  ingredientsHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444"
  },
  ingredientLine: {
    fontSize: 13,
    color: "#222",
    lineHeight: 18
  },
  recipeText: {
    fontSize: 13,
    color: "#222",
    lineHeight: 19
  },
  recipePreviewHint: {
    fontSize: 12,
    color: "#557",
    fontStyle: "italic"
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  sheetTitle: { fontSize: 14, fontWeight: "600", color: "#111" },
  sheetCancel: { fontSize: 15, color: "#666" },
  sheetDone: { fontSize: 15, color: "#2f6f58", fontWeight: "600" },
  iosPicker: { alignSelf: "stretch" }
});
