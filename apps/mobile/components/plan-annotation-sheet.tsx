import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
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
import { trpc } from "../lib/trpc";
import type { ThemeColors } from "../lib/design/tokens";
import { useThemeColors, useIsDark } from "../lib/design/use-theme-colors";

/**
 * Round 14 Task 2 — annotation editor for a single plan dish.
 *
 * Surfaces the four annotation fields (actualEffort, timeTakenMinutes,
 * verdict, annotationNotes) with debounced auto-save. The mutation
 * patches whatever changed; nulls clear a field. Optimistic UI:
 *   - Local state updates instantly on user input.
 *   - We push the same change into the tRPC cache via setData so the
 *     parent row's badges update without waiting for the round-trip.
 *   - On error we alert + invalidate so the cache resyncs from the
 *     server (rollback through truth-source).
 *
 * Effort uses the 4-segment quick/easy/medium/high_effort enum to match
 * the server validator. Handoff suggested 3 segments (Light/Moderate/
 * Intensive); the 4-segment shape is the data model and the meal log
 * form already uses it, so we match.
 *
 * R19.7: theme-aware. Styles are built via `makeStyles(colors)` and
 * memoised on the palette reference inside the component.
 */

type EffortValue = "quick" | "easy" | "medium" | "high_effort";
type VerdictValue = "repeat" | "modify" | "do_not_repeat";

const EFFORT_OPTIONS: Array<{ value: EffortValue; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High" }
];

/**
 * Verdict palette — repeat/modify/don't-repeat have semantic colors
 * (green/amber/red). In dark mode we lighten each hue so it carries
 * against the warm-near-black ground.
 */
function verdictOptions(isDark: boolean): Array<{
  value: VerdictValue;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> {
  return [
    {
      value: "repeat",
      label: "Repeat",
      icon: "checkmark-circle-outline",
      color: isDark ? "#88B894" : "#2F6F58"
    },
    {
      value: "modify",
      label: "Modify",
      icon: "alert-circle-outline",
      color: isDark ? "#D9B66E" : "#A3691B"
    },
    {
      value: "do_not_repeat",
      label: "Don't repeat",
      icon: "close-circle-outline",
      color: isDark ? "#D88078" : "#B91C1C"
    }
  ];
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end"
    },
    sheet: {
      backgroundColor: colors.paper,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: "92%"
    },
    handleWrap: {
      alignItems: "center",
      paddingVertical: 10
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.ink4
    },
    body: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 14
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: colors.ink
    },
    savingIndicator: {
      minWidth: 60,
      alignItems: "flex-end"
    },
    savingText: { fontSize: 11, color: colors.wheat },
    savedText: { fontSize: 11, color: colors.ink3 },
    subtitle: { fontSize: 13, color: colors.ink2 },
    field: { gap: 6 },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.ink2,
      letterSpacing: 0.2
    },
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
    notesInput: {
      minHeight: 96
    },
    segmented: {
      flexDirection: "row",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      backgroundColor: colors.surface
    },
    segment: {
      flex: 1,
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10
    },
    segmentDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border
    },
    segmentActive: {
      backgroundColor: colors.forest
    },
    segmentPressed: { backgroundColor: colors.sageBg },
    segmentLabel: { fontSize: 13, fontWeight: "500", color: colors.ink2 },
    segmentLabelActive: { color: colors.forestText },
    clearLink: {
      color: colors.forest,
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2
    },
    verdictRow: {
      flexDirection: "row",
      gap: 8
    },
    verdictButton: {
      flex: 1,
      minHeight: 56,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4
    },
    verdictPressed: { backgroundColor: colors.creamSoft },
    verdictLabel: { fontSize: 12, fontWeight: "500", color: colors.ink2 },
    verdictLabelActive: { color: colors.forestText },
    pressed: { opacity: 0.85 },
    doneButton: {
      marginTop: 6,
      minHeight: 48,
      borderRadius: 10,
      backgroundColor: colors.sageBg,
      alignItems: "center",
      justifyContent: "center"
    },
    doneText: {
      color: colors.forest,
      fontSize: 15,
      fontWeight: "600"
    }
  });
}

export type PlanAnnotationSheetProps = {
  visible: boolean;
  onClose: () => void;
  planId: string;
  planDishId: string;
  dishName: string;
  initial: {
    actualEffort: EffortValue | null;
    timeTakenMinutes: number | null;
    verdict: VerdictValue | null;
    annotationNotes: string | null;
  };
};

export function PlanAnnotationSheet({
  visible,
  onClose,
  planId,
  planDishId,
  dishName,
  initial
}: PlanAnnotationSheetProps) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const VERDICT_OPTIONS = useMemo(() => verdictOptions(isDark), [isDark]);
  const utils = trpc.useUtils();

  const [effort, setEffort] = useState<EffortValue | null>(initial.actualEffort);
  const [timeText, setTimeText] = useState<string>(
    initial.timeTakenMinutes != null ? String(initial.timeTakenMinutes) : ""
  );
  const [verdict, setVerdict] = useState<VerdictValue | null>(initial.verdict);
  const [notes, setNotes] = useState<string>(initial.annotationNotes ?? "");
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seed local state whenever the sheet opens against a different dish.
  // Without this guard, a previously edited dish's state would leak into
  // the next open if the parent didn't unmount the component.
  useEffect(() => {
    if (visible) {
      setEffort(initial.actualEffort);
      setTimeText(initial.timeTakenMinutes != null ? String(initial.timeTakenMinutes) : "");
      setVerdict(initial.verdict);
      setNotes(initial.annotationNotes ?? "");
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, planDishId]);

  const mutation = trpc.plans.updateDishAnnotation.useMutation({
    onSuccess: async () => {
      await utils.plans.getById.invalidate({ planId });
      await utils.plans.effortAggregate.invalidate({ planId });
      setSaving(false);
    },
    onError: (error) => {
      setSaving(false);
      Alert.alert(
        "Couldn't save",
        error.message || "We couldn't save that annotation. Try again."
      );
      // Re-invalidate so any optimistic UI mismatch resyncs from server.
      void utils.plans.getById.invalidate({ planId });
    }
  });

  function scheduleSave(patch: {
    actualEffort?: EffortValue | null;
    timeTakenMinutes?: number | null;
    verdict?: VerdictValue | null;
    annotationNotes?: string | null;
  }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaving(true);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({
        planDishId,
        patch
      });
    }, 350);
  }

  function changeEffort(next: EffortValue) {
    // Toggle off when tapping the active segment — same as web's pattern
    // (Round 5). Sets to null so the badge clears.
    const value: EffortValue | null = effort === next ? null : next;
    setEffort(value);
    scheduleSave({ actualEffort: value });
  }

  function changeVerdict(next: VerdictValue) {
    const value: VerdictValue | null = verdict === next ? null : next;
    setVerdict(value);
    scheduleSave({ verdict: value });
  }

  function changeTime(text: string) {
    // Allow empty to clear. Strip non-digits as the user types.
    const cleaned = text.replace(/[^\d]/g, "").slice(0, 4);
    setTimeText(cleaned);
    const value = cleaned === "" ? null : Math.max(0, Math.min(60 * 24, Number(cleaned)));
    scheduleSave({ timeTakenMinutes: value });
  }

  function changeNotes(text: string) {
    setNotes(text);
    // Cap at validator limit; trim happens server-side too.
    if (text.length <= 2000) {
      scheduleSave({ annotationNotes: text.trim() || null });
    }
  }

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
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {dishName}
                </Text>
                <View style={styles.savingIndicator}>
                  {saving ? (
                    <Text style={styles.savingText}>Saving…</Text>
                  ) : (
                    <Text style={styles.savedText}>Saved</Text>
                  )}
                </View>
              </View>
              <Text style={styles.subtitle}>How did this dish go?</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Actual effort</Text>
                <View style={styles.segmented}>
                  {EFFORT_OPTIONS.map((opt, idx) => {
                    const isActive = effort === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => changeEffort(opt.value)}
                        style={({ pressed }) => [
                          styles.segment,
                          idx > 0 && styles.segmentDivider,
                          isActive && styles.segmentActive,
                          pressed && !isActive && styles.segmentPressed
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            isActive && styles.segmentLabelActive
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {effort ? (
                  <Pressable
                    onPress={() => changeEffort(effort)}
                    hitSlop={6}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text style={styles.clearLink}>Clear effort</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Time taken (minutes)</Text>
                <TextInput
                  value={timeText}
                  onChangeText={changeTime}
                  keyboardType="number-pad"
                  placeholder="e.g. 45"
                  placeholderTextColor={colors.ink3}
                  style={styles.input}
                  maxLength={4}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Verdict</Text>
                <View style={styles.verdictRow}>
                  {VERDICT_OPTIONS.map((opt) => {
                    const active = verdict === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => changeVerdict(opt.value)}
                        style={({ pressed }) => [
                          styles.verdictButton,
                          active && {
                            backgroundColor: opt.color,
                            borderColor: opt.color
                          },
                          pressed && !active && styles.verdictPressed
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={18}
                          color={active ? colors.forestText : opt.color}
                        />
                        <Text
                          style={[
                            styles.verdictLabel,
                            active && styles.verdictLabelActive
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={changeNotes}
                  placeholder="What worked, what to change for next time."
                  placeholderTextColor={colors.ink3}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  style={[styles.input, styles.notesInput]}
                />
              </View>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
