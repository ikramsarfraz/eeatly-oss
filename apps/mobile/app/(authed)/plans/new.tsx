import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
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
import { createPlanSchema } from "@eeatly/api/validators/plans";
import { TopNav } from "../../../components/top-nav";
import { colors } from "../../../lib/design/tokens";
import { trpc } from "../../../lib/trpc";
import {
  Button,
  Card,
  Input,
  PageTitle,
  Screen
} from "../../../components/ui";

/**
 * Round 18 new-plan form. Editorial title + form fields + primary CTA.
 *
 * `UPGRADE_REQUIRED` triggers an in-app modal pointing at web pricing
 * since plans are gated.
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
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="New plan"
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
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
            paddingTop: 12,
            paddingBottom: 32
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 22 }}>
            <PageTitle
              title="A new plan"
              size="md"
              subtitle="Name the occasion and pick a date. Add dishes next."
            />
          </View>

          <View style={{ gap: 18 }}>
            <Input
              label="Plan name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (nameError) setNameError(null);
              }}
              placeholder="Eid 2026, Sunday potluck, …"
              autoCapitalize="sentences"
              autoCorrect
              maxLength={80}
              editable={!submitting}
              error={nameError ?? undefined}
            />

            <View style={{ gap: 8 }}>
              <Text
                className="font-body-semibold text-body-md text-ink"
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

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={!canSubmit}
              onPress={handleSubmit}
            >
              Create plan
            </Button>
          </View>
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
          style={{
            flex: 1,
            backgroundColor: "rgba(20,20,15,0.5)",
            justifyContent: "center",
            padding: 22
          }}
          onPress={() => setUpgradeOpen(false)}
        >
          <Pressable onPress={() => null} style={{ alignSelf: "stretch", maxWidth: 360, marginHorizontal: "auto" }}>
            <Card>
              <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    height: 56,
                    width: 56,
                    borderRadius: 99,
                    backgroundColor: colors.wheat,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Ionicons name="sparkles-outline" size={26} color={colors.ink} />
                </View>
                <Text
                  className="font-display text-display-xs text-ink text-center"
                  style={{ letterSpacing: -0.4 }}
                >
                  Plans are part of eeatly Plus
                </Text>
                <Text className="font-body text-body-md text-ink-2 text-center">
                  Upgrade on the web to plan menus and clone occasions
                  year-over-year. Manual logging stays free.
                </Text>
                <View style={{ alignSelf: "stretch", gap: 10, marginTop: 8 }}>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={() =>
                      Linking.openURL("https://eeatly.app/pricing")
                    }
                  >
                    See Plus on the web
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    onPress={() => setUpgradeOpen(false)}
                  >
                    Maybe later
                  </Button>
                </View>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
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
