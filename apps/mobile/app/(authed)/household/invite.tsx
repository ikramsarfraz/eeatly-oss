import { useState } from "react";
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
import { createInvitationSchema } from "@eeatly/api/validators/households";
import { trpc } from "../../../lib/trpc";

/**
 * Round 14 Task 4 — send a household invitation.
 *
 * Owner-only: `households.invite` is `householdOwnerProcedure`. A
 * non-owner who somehow reaches this screen sees `NOT_HOUSEHOLD_OWNER`
 * surfaced as a friendly alert; the household screen (Task 5) hides
 * the entry point for non-owners.
 *
 * On success we pop back to the household screen which refreshes the
 * pending-invitations section.
 */

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export default function InviteScreen() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const invite = trpc.households.invite.useMutation({
    onSuccess: async (_result, vars) => {
      await utils.households.pendingInvitations.invalidate();
      Alert.alert(
        "Invitation sent",
        `We emailed an invite to ${vars.email}.`,
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      if (reason === "UPGRADE_REQUIRED") {
        setUpgradeOpen(true);
        return;
      }
      const message =
        reason === "RATE_LIMITED"
          ? "You've sent a lot of invitations today. Try again tomorrow."
          : reason === "NOT_HOUSEHOLD_OWNER"
            ? "Only the household owner can send invitations."
            : reason === "INVITATION_EMAIL_MISMATCH"
              ? "Couldn't send to that email."
              : error.message || "Couldn't send the invitation. Try again.";
      Alert.alert("Couldn't invite", message);
    }
  });

  function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    const parsed = createInvitationSchema.safeParse({ email: trimmed });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Enter a valid email.");
      return;
    }
    setEmailError(null);
    invite.mutate(parsed.data);
  }

  const submitting = invite.isPending;
  const canSubmit = email.trim().length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Invite", headerBackTitle: "Back" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Invite to your kitchen</Text>
          <Text style={styles.body}>
            Their recipes and cook logs will merge into your shared kitchen
            when they accept. The invitation email lasts a few days.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (emailError) setEmailError(null);
              }}
              placeholder="mom@example.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              style={styles.input}
              editable={!submitting}
            />
            {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
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
              <>
                <Ionicons name="mail-outline" size={18} color="#fff" />
                <Text style={styles.submitText}>Send invitation</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
            <Text style={styles.upgradeTitle}>Inviting is a Plus feature</Text>
            <Text style={styles.upgradeBody}>
              Upgrade on the web to add family members to your shared
              kitchen. Solo cooking stays free.
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 48
  },
  heading: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111"
  },
  body: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20
  },
  field: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333"
  },
  required: { color: "#b91c1c" },
  input: {
    minHeight: 48,
    borderColor: "#d4d2cb",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111"
  },
  error: { color: "#b91c1c", fontSize: 12 },
  submit: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#2f6f58",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  submitDisabled: { backgroundColor: "#a7c6b8" },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  pressed: { opacity: 0.85 },
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
