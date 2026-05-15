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
  View
} from "react-native";
import { mealLogInputSchema } from "@eeatly/api/validators/meals";
import type { MealLogInput } from "@eeatly/api/validators/meals";
import { trpc } from "../lib/trpc";
import { PhotoPicker } from "./photo-picker";
import { SourceUrlInputPreview } from "./embeds/source-url-input-preview";
import { Button, Card, CardBody, Input, ListItem } from "./ui";

/**
 * Round 17 meal log form — NativeWind rebuild of the R13 form.
 *
 * Two callers:
 *   - `/add/log` — plain manual log, autocompletes against the
 *     household library, no recipe preview.
 *   - `/add/ai-suggest` — review-and-edit after the AI returns a
 *     suggestion. Recipe text + extracted ingredients show as a
 *     read-only preview card above the fields.
 *
 * Submit funnels through `meals.createLog` either way; the server's
 * `(householdId, normalizedName)` idempotency means typing an
 * existing name (or AI guessing one) produces a re-cook log, not a
 * duplicate meal.
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
        contentContainerClassName="p-4 pb-12 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        {showRecipePreview &&
        (recipeText || (ingredients?.length ?? 0) > 0) ? (
          <Card>
            <CardBody>
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="sparkles-outline" size={16} color="#2C5F3F" />
                <Text className="text-caption-strong font-semibold uppercase tracking-wider text-primary">
                  What the AI read
                </Text>
              </View>
              {ingredients && ingredients.length > 0 ? (
                <View className="gap-1 mb-3">
                  <Text className="text-caption-strong font-semibold text-foreground">
                    Ingredients
                  </Text>
                  {ingredients.map((line, i) => (
                    <Text
                      key={`${line}-${i}`}
                      className="text-caption text-foreground"
                    >
                      •  {line}
                    </Text>
                  ))}
                </View>
              ) : null}
              {recipeText ? (
                <View className="gap-1">
                  <Text className="text-caption-strong font-semibold text-foreground">
                    Recipe
                  </Text>
                  <Text className="text-caption text-foreground leading-5">
                    {recipeText}
                  </Text>
                </View>
              ) : null}
              <Text className="text-small italic text-foreground-muted mt-3">
                Saved as-is when you tap save. Edit the name, photo, or
                effort below if the AI got something off.
              </Text>
            </CardBody>
          </Card>
        ) : null}

        <Input
          label="Meal name"
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
                    color="#2C5F3F"
                  />
                }
                trailing={
                  <Text className="text-caption-strong font-semibold text-primary">
                    Log again
                  </Text>
                }
                onPress={() => handleSelectSuggestion(s.name)}
                divider={i < suggestions.length - 1}
              />
            ))}
          </Card>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-caption-strong font-semibold text-foreground">
            When did you cook this?
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            disabled={submitting}
            className={`flex-row items-center justify-between rounded-md border border-border bg-background-elevated px-3 h-11 active:bg-background-muted ${
              submitting ? "opacity-50" : ""
            }`}
          >
            <Text className="text-body text-foreground">
              {formatDateLabel(cookedDate)}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#6B7068" />
          </Pressable>
        </View>

        <View className="gap-1.5">
          <Text className="text-caption-strong font-semibold text-foreground">
            Photo
          </Text>
          <PhotoPicker
            value={photoUrl}
            onChange={setPhotoUrl}
            disabled={submitting}
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-caption-strong font-semibold text-foreground">
            Effort
          </Text>
          <View className="flex-row rounded-md border border-border bg-background-elevated overflow-hidden">
            {EFFORT_OPTIONS.map((opt, idx) => {
              const active = effort === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setEffort(opt.value)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`flex-1 h-11 items-center justify-center ${
                    idx > 0 ? "border-l border-border" : ""
                  } ${active ? "bg-primary" : "active:bg-background-muted"}`}
                >
                  <Text
                    className={`text-caption-strong font-semibold ${
                      active ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Notes"
          helper="What worked, what to change next time. Optional."
          value={notes}
          onChangeText={setNotes}
          placeholder="Doubled the garlic, used chicken stock instead of water…"
          multiline
          maxLength={1000}
          editable={!submitting}
        />

        <View className="gap-1.5">
          <Input
            label="Source URL"
            helper="YouTube, TikTok, Pinterest, or any recipe link. Optional."
            value={recipeSourceUrl}
            onChangeText={setRecipeSourceUrl}
            placeholder="https://youtube.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="url"
            keyboardType="url"
            textContentType="URL"
            editable={!submitting}
          />
          <SourceUrlInputPreview url={recipeSourceUrl} />
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
        className="flex-1 bg-foreground/40 justify-end"
        onPress={onCancel}
      >
        <Pressable
          onPress={() => null}
          className="bg-background-elevated rounded-t-lg pb-6"
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text className="text-body text-foreground-muted">Cancel</Text>
            </Pressable>
            <Text className="text-caption-strong font-semibold text-foreground">
              When did you cook this?
            </Text>
            <Pressable onPress={() => onConfirm(formatYMD(draft))} hitSlop={12}>
              <Text className="text-body font-semibold text-primary">Done</Text>
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
