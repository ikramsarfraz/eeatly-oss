import { useEffect, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
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
import { clonePlanSchema } from "@eeatly/api/validators/plans";
import { trpc } from "../lib/trpc";

/**
 * Round 14 Task 3 — clone-past-plan sheet. Triggered by long-press on a
 * plan tile in `/plans`. Name pre-fills via the local `bumpYearInName`
 * helper (lifted from the web — see comment above the function). Date
 * defaults to today; the user almost always sets it to whenever this
 * year's Eid lands.
 *
 * On success: invalidates the plans list (so the new clone shows
 * up at the top) and navigates to its detail page where hints will
 * render automatically via `plans.previousAnnotationsByMeal`.
 */

/**
 * Pre-fill the new plan's name when cloning. "Eid al-Adha 2024" →
 * "Eid al-Adha 2025" so the user doesn't retype the title. Fall back
 * to "<name> (copy)" when no year is detected.
 *
 * Mirrors `apps/web/lib/plans/clone-name.ts`. Inlined here rather than
 * promoted to `packages/shared` to keep the R14 backend untouched —
 * a packages/shared addition would otherwise mean a web import-path
 * change. The function is 12 lines; the duplication cost is lower than
 * the cross-package coordination.
 */
const YEAR_REGEX = /\b(19\d{2}|20\d{2})\b/g;
function bumpYearInName(name: string): string {
  const matches = Array.from(name.matchAll(YEAR_REGEX));
  if (matches.length === 0) return `${name} (copy)`;
  const last = matches[matches.length - 1]!;
  const year = Number(last[0]);
  const start = last.index ?? 0;
  const end = start + last[0].length;
  return `${name.slice(0, start)}${year + 1}${name.slice(end)}`;
}

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

export type ClonePlanSheetProps = {
  visible: boolean;
  onClose: () => void;
  sourcePlanId: string;
  sourceName: string;
};

export function ClonePlanSheet({
  visible,
  onClose,
  sourcePlanId,
  sourceName
}: ClonePlanSheetProps) {
  const utils = trpc.useUtils();

  const [name, setName] = useState(() => bumpYearInName(sourceName));
  const [scheduledDate, setScheduledDate] = useState<string>(() =>
    formatYMD(new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Re-seed when the sheet opens against a different source.
  useEffect(() => {
    if (visible) {
      setName(bumpYearInName(sourceName));
      setScheduledDate(formatYMD(new Date()));
      setNameError(null);
      setUpgradeOpen(false);
    }
  }, [visible, sourceName]);

  const cloneMutation = trpc.plans.cloneFromPast.useMutation({
    onSuccess: async (result) => {
      await utils.plans.list.invalidate();
      onClose();
      router.push(`/(authed)/plans/${result.newPlanId}` as never);
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      if (reason === "UPGRADE_REQUIRED") {
        setUpgradeOpen(true);
        return;
      }
      Alert.alert(
        "Couldn't clone",
        reason === "RATE_LIMITED"
          ? "Slow down a moment and try again."
          : error.message || "Try again."
      );
    }
  });

  function handleSubmit() {
    const parsed = clonePlanSchema.safeParse({
      sourcePlanId,
      newName: name.trim(),
      newScheduledDate: scheduledDate
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.message ?? "Check the form.";
      if (issue?.path?.[0] === "newName") setNameError(msg);
      else Alert.alert("Check the form", msg);
      return;
    }
    setNameError(null);
    cloneMutation.mutate(parsed.data);
  }

  const submitting = cloneMutation.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => null}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
          >
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Clone "{sourceName}"</Text>
              <Text style={styles.subtitle}>
                Dishes and notes carry over. Set the new name and date
                below — last year's verdicts will appear as hints on each
                dish.
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>
                  New name <Text style={styles.required}>*</Text>
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
                {nameError ? (
                  <Text style={styles.error}>{nameError}</Text>
                ) : null}
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
                  <Text style={styles.submitText}>Clone plan</Text>
                )}
              </Pressable>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelRow,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>

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
            <Text style={styles.upgradeTitle}>Cloning is a Plus feature</Text>
            <Text style={styles.upgradeBody}>
              Upgrade on the web to clone past plans and bring last year's
              notes forward.
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
    </Modal>
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
        <Pressable style={styles.datePickSheet} onPress={() => null}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetHeaderTitle}>Plan date</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "90%"
  },
  handleWrap: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#dcd9d2" },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14
  },
  title: { fontSize: 18, fontWeight: "600", color: "#111" },
  subtitle: { fontSize: 13, color: "#555", lineHeight: 19 },
  field: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    letterSpacing: 0.2
  },
  required: { color: "#b91c1c" },
  input: {
    minHeight: 46,
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
  error: { color: "#b91c1c", fontSize: 12 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  submit: {
    marginTop: 6,
    minHeight: 50,
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
  cancelRow: {
    alignItems: "center",
    paddingTop: 4
  },
  cancelText: { color: "#666", fontSize: 14 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  datePickSheet: {
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
  sheetHeaderTitle: { fontSize: 14, fontWeight: "600", color: "#111" },
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
