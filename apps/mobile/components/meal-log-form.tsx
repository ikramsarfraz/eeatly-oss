import { useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
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
import { mealLogInputSchema } from "@eeatly/api/validators/meals";
import type { MealLogInput } from "@eeatly/api/validators/meals";
import { trpc } from "../lib/trpc";
import { useThemeColors } from "../lib/design/use-theme-colors";
import { PhotoPicker } from "./photo-picker";
import { SourceUrlInputPreview } from "./embeds/source-url-input-preview";
import { Button, Card, CardBody, Input, ListItem } from "./ui";

/**
 * Round 18 meal log form — editorial rebuild.
 *
 * Stack: meal-name + autocomplete → date → photo zone (dashed cream
 * tile) → effort 4-segment pill → italic-serif notes → mono URL input
 * with embed preview → save CTA.
 *
 * Two callers:
 *   - `/add/log` — quick manual log, autocompletes against the
 *     household library.
 *   - `/add/ai-suggest` — review/edit after the AI returns a draft;
 *     `showRecipePreview` renders the read-only extraction card above
 *     the fields.
 *
 * Submit funnels through `meals.createLog`; the server's
 * `(householdId, normalizedName)` idempotency means typing an existing
 * name produces a re-cook log, not a duplicate meal.
 */

type EffortValue = MealLogInput["effortLevel"];

const EFFORT_OPTIONS: Array<{ value: EffortValue; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High" }
];

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
  initialValues?: Partial<MealLogInput>;
  showRecipePreview?: boolean;
  submitSource?: "quick_log" | "log_again";
  hideAutocomplete?: boolean;
  submitLabel?: string;
};

function FieldLabel({
  children,
  optional
}: {
  children: string;
  optional?: boolean;
}) {
  return (
    <Text
      className="font-body-semibold text-body-md text-ink dark:text-ink-dark mb-2"
      style={{ letterSpacing: -0.1 }}
    >
      {children}
      {optional ? (
        <Text className="font-body text-body-md text-ink-3 dark:text-ink-3-dark"> · optional</Text>
      ) : null}
    </Text>
  );
}

export function MealLogForm({
  initialValues,
  showRecipePreview,
  submitSource = "quick_log",
  hideAutocomplete,
  submitLabel = "Save meal log"
}: MealLogFormProps) {
  const colors = useThemeColors();
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

  const recipeText = initialValues?.recipeText ?? "";
  const ingredients = initialValues?.ingredients;

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
    return data
      .filter((m) => m.name.trim().toLowerCase() !== lower)
      .slice(0, 5);
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
      ingredients:
        ingredients && ingredients.length > 0 ? ingredients : undefined
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
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 14,
          paddingBottom: 32,
          gap: 18
        }}
        keyboardShouldPersistTaps="handled"
      >
        {showRecipePreview &&
        (recipeText || (ingredients?.length ?? 0) > 0) ? (
          <Card>
            <CardBody>
              <View
                className="flex-row items-center mb-2"
                style={{ gap: 8 }}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={colors.forest}
                />
                <Text
                  className="font-body-semibold text-label text-forest dark:text-forest-dark uppercase"
                  style={{ letterSpacing: 1.4 }}
                >
                  What the AI read
                </Text>
              </View>
              {ingredients && ingredients.length > 0 ? (
                <View style={{ gap: 4, marginBottom: 12 }}>
                  <Text
                    className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                    style={{ letterSpacing: -0.1 }}
                  >
                    Ingredients
                  </Text>
                  {ingredients.map((line: string, i: number) => (
                    <Text
                      key={`${line}-${i}`}
                      className="font-body text-body-md text-ink dark:text-ink-dark"
                    >
                      •  {line}
                    </Text>
                  ))}
                </View>
              ) : null}
              {recipeText ? (
                <View style={{ gap: 4 }}>
                  <Text
                    className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                    style={{ letterSpacing: -0.1 }}
                  >
                    Recipe
                  </Text>
                  <Text
                    className="font-body text-body-md text-ink dark:text-ink-dark"
                    style={{ lineHeight: 21 }}
                  >
                    {recipeText}
                  </Text>
                </View>
              ) : null}
              <Text className="font-display-italic text-body-md text-ink-3 dark:text-ink-3-dark mt-3">
                Saved as-is when you tap save. Edit the name, photo, or
                effort below if the AI got something off.
              </Text>
            </CardBody>
          </Card>
        ) : null}

        <View>
          <FieldLabel>Meal name</FieldLabel>
          <Input
            value={mealName}
            onChangeText={(t) => {
              setMealName(t);
              setSuggestionsHidden(false);
              if (nameError) setNameError(null);
            }}
            placeholder="What did you cook?"
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="next"
            editable={!submitting}
            error={nameError ?? undefined}
          />
        </View>

        {suggestions.length > 0 ? (
          <Card variant="outlined">
            {suggestions.map((s, i) => (
              <ListItem
                key={s.id}
                title={s.name}
                leading={
                  <Ionicons
                    name="restaurant-outline"
                    size={20}
                    color={colors.forest}
                  />
                }
                trailing={
                  <Text className="font-body-semibold text-body-sm text-forest dark:text-forest-dark">
                    Log again
                  </Text>
                }
                onPress={() => handleSelectSuggestion(s.name)}
                divider={i > 0}
              />
            ))}
          </Card>
        ) : null}

        <View>
          <FieldLabel>When</FieldLabel>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            disabled={submitting}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 16,
              height: 48,
              opacity: submitting ? 0.5 : 1
            }}
          >
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 15,
                color: colors.ink
              }}
            >
              {formatDateLabel(cookedDate)}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.ink3} />
          </Pressable>
        </View>

        <View>
          <FieldLabel optional>Photo</FieldLabel>
          <PhotoPicker
            value={photoUrl}
            onChange={setPhotoUrl}
            disabled={submitting}
          />
        </View>

        <View>
          <FieldLabel>Effort</FieldLabel>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 99,
              padding: 4,
              gap: 2
            }}
          >
            {EFFORT_OPTIONS.map((opt) => {
              const active = effort === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setEffort(opt.value)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 99,
                    backgroundColor: active ? colors.forest : "transparent",
                    alignItems: "center"
                  }}
                >
                  <Text
                    style={{
                      fontFamily: active
                        ? "Geist_600SemiBold"
                        : "Geist_500Medium",
                      fontSize: 13.5,
                      color: active ? colors.forestText : colors.ink2,
                      letterSpacing: -0.1
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel optional>Notes</FieldLabel>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Doubled the garlic. Used chicken stock instead of water…"
            multiline
            maxLength={1000}
            editable={!submitting}
            italicSerif
            helper="What worked, what to change next time."
          />
        </View>

        <View>
          <FieldLabel optional>Source URL</FieldLabel>
          <Input
            value={recipeSourceUrl}
            onChangeText={setRecipeSourceUrl}
            placeholder="https://youtube.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="url"
            keyboardType="url"
            textContentType="URL"
            editable={!submitting}
            mono
          />
          <View style={{ marginTop: 12 }}>
            <SourceUrlInputPreview url={recipeSourceUrl} />
          </View>
        </View>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          {submitLabel}
        </Button>
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

function DatePickerSheet({
  value,
  onConfirm,
  onCancel
}: {
  value: string;
  onConfirm: (next: string) => void;
  onCancel: () => void;
}) {
  const colors = useThemeColors();
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
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(20,20,15,0.32)",
          justifyContent: "flex-end"
        }}
        onPress={onCancel}
      >
        <Pressable
          onPress={() => null}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingBottom: 32
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSoft
            }}
          >
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text
                style={{
                  fontFamily: "Geist_500Medium",
                  fontSize: 15,
                  color: colors.ink2
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 14,
                color: colors.ink,
                letterSpacing: -0.1
              }}
            >
              When did you cook this?
            </Text>
            <Pressable onPress={() => onConfirm(formatYMD(draft))} hitSlop={10}>
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 15,
                  color: colors.forest
                }}
              >
                Done
              </Text>
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
            style={{ alignSelf: "stretch" }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Re-export so screens importing TextInput from this file still get
// the styled fallback. Kept to limit breakage on R17 callsites.
export const _StyledTextInput = TextInput;
