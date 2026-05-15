import { useEffect, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
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
import { updatePlanSchema } from "@eeatly/api/validators/plans";
import { trpc } from "../../../../lib/trpc";

/**
 * Round 14 Task 2 — edit plan metadata (name + scheduled date only).
 * Dish editing happens on the plan detail page.
 *
 * Form lives behind a save button rather than per-field auto-save —
 * fewer round trips for metadata edits which are infrequent and worth
 * confirming explicitly.
 */

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
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";

  const planQuery = trpc.plans.getById.useQuery(
    { planId },
    { enabled: planId.length > 0 }
  );

  const [name, setName] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (planQuery.data) {
      setName(planQuery.data.name);
      setScheduledDate(planQuery.data.scheduledDate ?? formatYMD(new Date()));
    }
  }, [planQuery.data]);

  const utils = trpc.useUtils();
  const update = trpc.plans.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.plans.list.invalidate(),
        utils.plans.getById.invalidate({ planId })
      ]);
      router.back();
    },
    onError: (e) =>
      Alert.alert("Couldn't save", e.message || "Try again.")
  });

  function handleSubmit() {
    const trimmed = name.trim();
    const parsed = updatePlanSchema.safeParse({
      name: trimmed,
      scheduledDate
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.message ?? "Check the form.";
      if (issue?.path?.[0] === "name") setNameError(msg);
      else Alert.alert("Check the form", msg);
      return;
    }
    setNameError(null);
    update.mutate({ planId, patch: parsed.data });
  }

  const submitting = update.isPending;
  const loading = planQuery.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Edit plan", headerBackTitle: "Back" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#2f6f58" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.label}>
                Plan name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (nameError) setNameError(null);
                }}
                style={styles.input}
                autoCapitalize="sentences"
                autoCorrect
                maxLength={80}
                editable={!submitting}
              />
              {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Planned date</Text>
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
                <Text style={styles.dateText}>
                  {formatDateLabel(scheduledDate)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </Pressable>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submit,
                !canSubmit && styles.submitDisabled,
                pressed && canSubmit && styles.pressed
              ]}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Save changes</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {showDatePicker ? (
        <DatePickerSheet
          value={scheduledDate}
          onConfirm={(next) => {
            setScheduledDate(next);
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      ) : null}
    </SafeAreaView>
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
        onChange={(event, next) => {
          if (event.type === "set" && next) onConfirm(formatYMD(next));
          else onCancel();
        }}
      />
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => null}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Plan date</Text>
            <Pressable onPress={() => onConfirm(formatYMD(draft))} hitSlop={12}>
              <Text style={styles.sheetDone}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
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
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
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
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12
  },
  dateText: { fontSize: 16, color: "#111" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  error: { color: "#b91c1c", fontSize: 12 },
  submit: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center"
  },
  submitDisabled: { backgroundColor: "#a7c6b8" },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  sheetBackdrop: {
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
