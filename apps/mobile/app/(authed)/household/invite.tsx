import { useState } from "react";
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
import { createInvitationSchema } from "@eeatly/api/validators/households";
import { trpc } from "../../../lib/trpc";
import { Button, Card, Input, Screen } from "../../../components/ui";

/**
 * Round 17 invite — NativeWind rebuild.
 *
 * Owner-only (server-enforced). Email-only form; success pops back
 * to the household screen and triggers a refresh of the pending list.
 * `UPGRADE_REQUIRED` triggers a modal pointing at web pricing.
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
        [{ text: "OK", onPress: () => router.back() }]
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
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Invite",
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
          <View className="gap-2">
            <Text className="text-heading-1 font-bold text-foreground">
              Invite to your kitchen
            </Text>
            <Text className="text-body text-foreground-muted">
              Their recipes and cook logs will merge into your shared kitchen
              when they accept. The invitation email lasts a few days.
            </Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (emailError) setEmailError(null);
            }}
            placeholder="mom@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!submitting}
            error={emailError ?? undefined}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            leadingIcon={
              <Ionicons name="mail-outline" size={18} color="#FBF8F1" />
            }
            onPress={handleSubmit}
          >
            Send invitation
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

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
                  Inviting is part of eeatly Plus
                </Text>
                <Text className="text-body text-foreground-muted text-center">
                  Upgrade on the web to add family members to your shared
                  kitchen. Solo cooking stays free.
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
