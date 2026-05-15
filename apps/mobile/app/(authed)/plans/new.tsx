import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
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
import { trpc } from "../../../lib/trpc";
import { Button, Card, Input, Screen } from "../../../components/ui";

/**
 * Round 17 new-plan form — NativeWind rebuild.
 *
 * Two fields: name (required) + scheduled date. Submit funnels
 * through `plans.create`. On success, route to the new plan's
 * detail page so the user can start adding dishes immediately.
 *
 * Plans are gated (`plans_create`) — `UPGRADE_REQUIRED` triggers
 * an in-app upgrade modal that deep-links to the web pricing page.
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
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "New plan",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FBF8F1" },
          headerTintColor: "#1A1F1B",
          headerTitleStyle: { fontWeight: "600" }
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          contentContainerClassName="p-4 pb-12 gap-4"
          keyboardShouldPersistTaps="handled"
        >
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

          <View className="gap-1.5">
            <Text className="text-caption-strong font-semibold text-foreground">
              Planned date
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              disabled={submitting}
              className={`flex-row items-center justify-between rounded-md border border-border bg-background-elevated px-3 h-11 active:bg-background-muted ${
                submitting ? "opacity-50" : ""
              }`}
            >
              <Text className="text-body text-foreground">
                {formatDateLabel(scheduledDate)}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#6B7068" />
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
          className="flex-1 bg-foreground/40 items-center justify-center p-6"
          onPress={() => setUpgradeOpen(false)}
        >
          <Pressable onPress={() => null} className="self-stretch max-w-[360px] mx-auto">
            <Card>
              <View className="px-5 py-6 gap-3 items-center">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
                  <Ionicons name="sparkles-outline" size={26} color="#1A1F1B" />
                </View>
                <Text className="text-heading-2 font-semibold text-foreground text-center">
                  Plans are part of eeatly Plus
                </Text>
                <Text className="text-body text-foreground-muted text-center">
                  Upgrade on the web to plan menus and clone occasions
                  year-over-year. Manual logging stays free.
                </Text>
                <View className="self-stretch gap-2 mt-2">
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
              Plan date
            </Text>
            <Pressable onPress={() => onConfirm(formatYMD(draft))} hitSlop={12}>
              <Text className="text-body font-semibold text-primary">Done</Text>
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
