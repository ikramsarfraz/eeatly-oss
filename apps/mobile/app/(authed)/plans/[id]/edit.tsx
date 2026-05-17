import { useEffect, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import { updatePlanSchema } from "@eeatly/api/validators/plans";
import { TopNav } from "../../../../components/top-nav";
import { useThemeColors } from "../../../../lib/design/use-theme-colors";
import { trpc } from "../../../../lib/trpc";
import {
  Input,
  LoadingScreen,
  Screen
} from "../../../../components/ui";

/**
 * Round 18 edit-plan — metadata-only form (name + scheduled date +
 * notes). Dish editing happens on the detail page.
 *
 * The destructive "Delete plan" row at the bottom uses the danger-soft
 * bg + danger text from the handoff. Confirm via Alert.
 */

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateValue(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleString("en-US", { weekday: "short" });
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${weekday}, ${month} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function EditPlanScreen() {
  const colors = useThemeColors();
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
    onError: (e) => Alert.alert("Couldn't save", e.message || "Try again.")
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

  function handleDelete() {
    Alert.alert(
      "Delete plan?",
      "Dishes stay in your library, but this plan disappears.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // TODO: wire to plans.delete once available; gracefully exits
            // for now since the mutation isn't exposed yet.
            Alert.alert(
              "Not yet wired",
              "Plan deletion ships in the next round. Edits stay."
            );
          }
        }
      ]
    );
  }

  const submitting = update.isPending;
  const loading = planQuery.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  if (loading) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav
          title="Edit plan"
          leftLabel="Cancel"
          onLeftPress={() => router.back()}
          showSettings={false}
        />
        <LoadingScreen />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Edit plan"
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        rightLabel={submitting ? "Saving…" : "Save"}
        onRightPress={canSubmit ? handleSubmit : undefined}
        showSettings={false}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: 32
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 18 }}>
            <Input
              label="Plan name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (nameError) setNameError(null);
              }}
              autoCapitalize="sentences"
              autoCorrect
              maxLength={80}
              editable={!submitting}
              error={nameError ?? undefined}
            />

            <View style={{ gap: 8 }}>
              <Text
                className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                style={{ letterSpacing: -0.1 }}
              >
                Planned date
              </Text>
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
                  {formatDateValue(scheduledDate)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.ink3} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleDelete}
            style={{
              marginTop: 32,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: colors.dangerSoft,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(168,65,58,0.12)"
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete plan"
          >
            <View style={{ flex: 1 }}>
              <Text
                className="font-body-semibold text-body-md text-danger dark:text-danger-dark"
                style={{ letterSpacing: -0.1 }}
              >
                Delete plan
              </Text>
              <Text
                className="font-body text-body-sm text-danger dark:text-danger-dark mt-0.5"
                style={{ opacity: 0.75 }}
              >
                Dishes stay in your library.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
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
    </Screen>
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
        onChange={(event, next) => {
          if (event.type === "set" && next) onConfirm(formatYMD(next));
          else onCancel();
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
              Plan date
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
