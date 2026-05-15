import { useEffect, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
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
import { trpc } from "../../../../lib/trpc";
import {
  Button,
  Input,
  LoadingScreen,
  Screen
} from "../../../../components/ui";

/**
 * Round 17 edit-plan — NativeWind rebuild. Metadata only (name +
 * scheduled date); dish editing happens on the plan detail page.
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

  const submitting = update.isPending;
  const loading = planQuery.isPending;
  const canSubmit = name.trim().length > 0 && !submitting;

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Edit plan",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <LoadingScreen />
      </>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Edit plan",
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
            Save changes
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
