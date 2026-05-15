import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
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
import { createPlanSchema } from "@eeatly/api/validators/plans";
import { trpc } from "../../../lib/trpc";

/**
 * Round 14 Task 2 — create a new plan. Name + scheduled date (required
 * per createPlanSchema). On success, push to the new plan's detail
 * page so the user immediately starts adding dishes.
 *
 * Plan creation is gated (`plans_create` defaults to `beta_or_paid`);
 * UPGRADE_REQUIRED maps to an inline modal pointing at web /pricing.
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

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export default function NewPlanScreen() {
  const [name, setName] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>(() =>
    formatYMD(new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const create = trpc.plans.create.useMutation({
    onSuccess: (result) => {
      router.replace(`/(authed)/plans/${result.planId}` as never);
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      if (reason === "UPGRADE_REQUIRED") {
        setUpgradeOpen(true);
        return;
      }
      Alert.alert(
        "Couldn't create plan",
        reason === "RATE_LIMITED"
          ? "Slow down a moment and try again."
          : error.message || "Try again."
      );
    }
  });

  function handleSubmit() {
    const trimmed = name.trim();
    const parsed = createPlanSchema.safeParse({
      name: trimmed,
      scheduledDate
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.message ?? "Check the form.";
      if (issue?.path?.[0] === "name") {
        setNameError(msg);
      } else {
        Alert.alert("Check the form", msg);
      }
      return;
    }
    setNameError(null);
    create.mutate(parsed.data);
  }

  const submitting = create.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "New plan", headerBackTitle: "Back" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
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
              placeholder="Eid 2026, Sunday potluck, …"
              placeholderTextColor="#999"
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
              <Text style={styles.submitText}>Create plan</Text>
            )}
          </Pressable>
        </ScrollView>
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

      <Modal
        visible={upgradeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUpgradeOpen(false)}
      >
        <Pressable
          style={styles.upgradeBackdrop}
          onPress={() => setUpgradeOpen(false)}
        >
          <Pressable style={styles.upgradeCard} onPress={() => null}>
            <Ionicons name="sparkles-outline" size={28} color="#2f6f58" />
            <Text style={styles.upgradeTitle}>Plans are a Plus feature</Text>
            <Text style={styles.upgradeBody}>
              Upgrade on the web to plan menus and clone occasions
              year-over-year. Manual logging stays free.
            </Text>
            <Pressable
              onPress={() => Linking.openURL("https://eeatly.app/pricing")}
              style={({ pressed }) => [
                styles.upgradeCta,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.upgradeCtaText}>See Plus on the web</Text>
            </Pressable>
            <Pressable onPress={() => setUpgradeOpen(false)} hitSlop={8}>
              <Text style={styles.upgradeCancel}>Maybe later</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  iosPicker: { alignSelf: "stretch" },
  upgradeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  upgradeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
    gap: 12,
    alignItems: "center",
    maxWidth: 360
  },
  upgradeTitle: {
    fontSize: 18,
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
  upgradeCta: {
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch"
  },
  upgradeCtaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  upgradeCancel: {
    color: "#666",
    fontSize: 14,
    marginTop: 4
  }
});
