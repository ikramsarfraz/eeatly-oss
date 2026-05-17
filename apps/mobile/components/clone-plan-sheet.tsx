import { useEffect, useMemo, useState } from "react";
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
import { bumpYearInName } from "@eeatly/shared";
import { trpc } from "../lib/trpc";
import type { ThemeColors } from "../lib/design/tokens";
import { useThemeColors } from "../lib/design/use-theme-colors";

/**
 * Round 14 Task 3 — clone-past-plan sheet. Triggered by long-press on
 * a plan tile in `/plans`. Name pre-fills via `bumpYearInName` from
 * `@eeatly/shared` (R15.5 Task 5 moved the helper here from R14's
 * inlined copy + web's `apps/web/lib/plans/clone-name.ts`). Date
 * defaults to today; the user almost always sets it to whenever this
 * year's Eid lands.
 *
 * On success: invalidates the plans list (so the new clone shows
 * up at the top) and navigates to its detail page where hints will
 * render automatically via `plans.previousAnnotationsByMeal`.
 *
 * R19.7: every color reads from `useThemeColors()`; the StyleSheet is
 * memoised on the palette reference. The scrim stays a literal
 * translucent black — it reads as the same dimming overlay in both
 * appearance modes.
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

export type ClonePlanSheetProps = {
  visible: boolean;
  onClose: () => void;
  sourcePlanId: string;
  sourceName: string;
};

type Styles = ReturnType<typeof makeStyles>;

export function ClonePlanSheet({
  visible,
  onClose,
  sourcePlanId,
  sourceName
}: ClonePlanSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
                  placeholderTextColor={colors.ink3}
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
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.ink2}
                  />
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
                  <ActivityIndicator color={colors.forestText} />
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
          styles={styles}
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
            <Ionicons
              name="sparkles-outline"
              size={28}
              color={colors.forest}
            />
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
  onCancel,
  styles
}: {
  value: string;
  onConfirm: (next: string) => void;
  onCancel: () => void;
  styles: Styles;
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      // Scrim is intentionally literal — a translucent black overlay
      // reads as a dimming effect against both cream (light) and warm
      // near-black (dark) surfaces.
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end"
    },
    sheet: {
      backgroundColor: colors.paper,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: "90%"
    },
    handleWrap: { alignItems: "center", paddingVertical: 10 },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.ink4
    },
    body: {
      paddingHorizontal: 20,
      paddingBottom: 28,
      gap: 14
    },
    title: { fontSize: 18, fontWeight: "600", color: colors.ink },
    subtitle: { fontSize: 13, color: colors.ink2, lineHeight: 19 },
    field: { gap: 6 },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.ink,
      letterSpacing: 0.2
    },
    required: { color: colors.danger },
    input: {
      minHeight: 46,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      backgroundColor: colors.surface,
      color: colors.ink
    },
    dateButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12
    },
    dateText: { fontSize: 16, color: colors.ink },
    error: { color: colors.danger, fontSize: 12 },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.55 },
    submit: {
      marginTop: 6,
      minHeight: 50,
      borderRadius: 12,
      backgroundColor: colors.forest,
      alignItems: "center",
      justifyContent: "center"
    },
    // `forestSoft` is the "lighter forest" sibling token — exactly the
    // role the original pale-green disabled bg played, and it inverts
    // correctly in dark mode (light sage instead of darker green).
    submitDisabled: { backgroundColor: colors.forestSoft },
    submitText: {
      color: colors.forestText,
      fontSize: 16,
      fontWeight: "600"
    },
    cancelRow: {
      alignItems: "center",
      paddingTop: 4
    },
    cancelText: { color: colors.ink2, fontSize: 14 },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end"
    },
    datePickSheet: {
      backgroundColor: colors.paper,
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
      borderColor: colors.borderSoft
    },
    sheetHeaderTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
    sheetCancel: { fontSize: 15, color: colors.ink2 },
    sheetDone: { fontSize: 15, color: colors.forest, fontWeight: "600" },
    iosPicker: { alignSelf: "stretch" },
    upgradeBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24
    },
    upgradeCard: {
      backgroundColor: colors.paper,
      borderRadius: 16,
      padding: 22,
      gap: 12,
      alignItems: "center",
      maxWidth: 360
    },
    upgradeTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.ink,
      textAlign: "center"
    },
    upgradeBody: {
      fontSize: 14,
      color: colors.ink2,
      textAlign: "center",
      lineHeight: 20
    },
    upgradeCta: {
      minHeight: 46,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: colors.forest,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch"
    },
    upgradeCtaText: {
      color: colors.forestText,
      fontSize: 15,
      fontWeight: "600"
    },
    upgradeCancel: {
      color: colors.ink2,
      fontSize: 14,
      marginTop: 4
    }
  });
}
