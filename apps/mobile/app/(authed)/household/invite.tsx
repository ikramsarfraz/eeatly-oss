import { useState } from "react";
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
import { createInvitationSchema } from "@eeatly/api/validators/households";
import { colors } from "../../../lib/design/tokens";
import { trpc } from "../../../lib/trpc";
import { TopNav } from "../../../components/top-nav";
import {
  Button,
  Card,
  Input,
  PageTitle,
  Screen
} from "../../../components/ui";

/**
 * Round 18 invite — editorial rebuild. Email-only form, owner-only
 * (server-enforced). Success pops back to the household screen and
 * triggers a refresh of the pending list.
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
    <Screen edges={["top", "bottom"]}>
      <TopNav
        title="Invite"
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
            paddingTop: 14,
            paddingBottom: 32,
            gap: 22
          }}
          keyboardShouldPersistTaps="handled"
        >
          <PageTitle
            title="Invite to your kitchen."
            size="sm"
            subtitle="Their recipes and cook logs merge into your shared kitchen when they accept. The invitation email lasts a few days."
          />

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
            mono
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            leadingIcon={
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.forestText}
              />
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
          style={{
            flex: 1,
            backgroundColor: "rgba(20,20,15,0.5)",
            justifyContent: "center",
            padding: 22
          }}
          onPress={() => setUpgradeOpen(false)}
        >
          <Pressable
            onPress={() => null}
            style={{ alignSelf: "stretch", maxWidth: 360, marginHorizontal: "auto" }}
          >
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
                  Inviting is part of eeatly Plus
                </Text>
                <Text className="font-body text-body-md text-ink-2 text-center">
                  Upgrade on the web to add family members to your shared
                  kitchen. Solo cooking stays free.
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
