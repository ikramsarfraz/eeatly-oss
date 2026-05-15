import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../lib/auth/client";
import { setPendingInvite } from "../../lib/auth/pending-invite";
import { clearSessionToken } from "../../lib/auth/session";
import { trpc } from "../../lib/trpc";

/**
 * Round 14 Task 4 — invite-accept screen. Sits OUTSIDE `(authed)` so
 * invitees can land here while signed out. Routes via the
 * `eeatly://invite/<token>` scheme (and the web fallback at
 * https://eeatly.app/invite/<token> if the OS doesn't recognize the
 * app on this device).
 *
 * Three states:
 *   1. Signed out: sign-in CTA. We stash the invite token so the
 *      magic-link round-trip routes the user back here.
 *   2. Signed in as the invited email: Accept / Decline.
 *   3. Signed in as a different email: mismatch screen with "Sign out
 *      and accept as <invited_email>" affordance.
 *
 * `households.invitationByToken` is a PUBLIC tRPC procedure (the token
 * is the access control). It returns `null` for unknown / expired /
 * already-used tokens; we surface that as a friendly invalid-invite
 * page rather than 404.
 */

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export default function InviteAcceptScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  const [currentEmail, setCurrentEmail] = useState<string | null | undefined>(
    undefined
  );
  const [busy, setBusy] = useState<"send-magic" | "accept" | "switch" | null>(null);

  const utils = trpc.useUtils();
  const inviteQuery = trpc.households.invitationByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, staleTime: 60_000 }
  );

  // Resolve the current session once. `setCurrentEmail` to undefined while
  // loading lets the render distinguish loading vs signed-out.
  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const res = await authClient.getSession();
        if (cancelled) return;
        setCurrentEmail(res.data?.user.email ?? null);
      } catch {
        if (!cancelled) setCurrentEmail(null);
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const acceptMutation = trpc.households.acceptInvitation.useMutation({
    onSuccess: async (result) => {
      setBusy(null);
      // Refresh queries that depend on the new household.
      await Promise.all([
        utils.dashboard.meals.invalidate(),
        utils.households.current.invalidate(),
        utils.plans.list.invalidate(),
        utils.search.meals.invalidate()
      ]);
      Alert.alert(
        "Welcome",
        `You're now part of ${result.newHouseholdName}.${
          result.mealsMoved > 0
            ? ` ${result.mealsMoved} of your meals and ${result.logsMoved} cook logs moved with you.`
            : ""
        }`,
        [
          {
            text: "Open kitchen",
            onPress: () => router.replace("/(authed)/home")
          }
        ]
      );
    },
    onError: (error) => {
      setBusy(null);
      const reason = getCauseReason(error);
      const message =
        reason === "INVITATION_NOT_FOUND"
          ? "This invitation isn't valid anymore. Ask for a new one."
          : reason === "INVITATION_EXPIRED"
            ? "This invitation has expired. Ask for a new one."
            : reason === "INVITATION_ALREADY_USED"
              ? "This invitation has already been used."
              : reason === "INVITATION_EMAIL_MISMATCH"
                ? "This invitation is for a different email address."
                : reason === "OWNERSHIP_TRANSFER_REQUIRED"
                  ? "You own a household with members. Transfer ownership or remove members before joining a new one."
                  : reason === "MEAL_NAME_COLLISION"
                    ? "Some of your meal names collide with the new kitchen's. Rename them and try again."
                    : error.message || "Couldn't accept the invitation.";
      Alert.alert("Couldn't accept", message);
    }
  });

  async function startMagicLink(email: string) {
    if (!token) return;
    setBusy("send-magic");
    try {
      await setPendingInvite(token);
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "eeatly://verify"
      });
      setBusy(null);
      if (error) {
        Alert.alert(
          "Couldn't send sign-in link",
          error.message || "Try again."
        );
        return;
      }
      Alert.alert(
        "Check your email",
        `We sent a sign-in link to ${email}. Tap it on this phone to come back and accept.`
      );
    } catch (e) {
      setBusy(null);
      Alert.alert(
        "Couldn't send sign-in link",
        e instanceof Error ? e.message : "Network error."
      );
    }
  }

  async function signOutAndContinue() {
    if (!token) return;
    setBusy("switch");
    try {
      await clearSessionToken();
      setCurrentEmail(null);
      setBusy(null);
    } catch {
      setBusy(null);
    }
  }

  function decline() {
    router.replace("/(authed)/home");
  }

  // -------- Render ----------------------------------------------------

  if (!token) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.title}>Invalid invitation</Text>
          <Text style={styles.body}>This invitation link is missing its token.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (inviteQuery.isPending || currentEmail === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color="#2f6f58" />
        </View>
      </SafeAreaView>
    );
  }

  const invite = inviteQuery.data;
  if (!invite || invite.acceptedAt || new Date(invite.expiresAt) < new Date()) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={32} color="#888" />
          <Text style={styles.title}>Invitation unavailable</Text>
          <Text style={styles.body}>
            {invite?.acceptedAt
              ? "This invitation has already been used."
              : invite
                ? "This invitation has expired. Ask the sender for a new one."
                : "We couldn't find this invitation. The link may have been revoked."}
          </Text>
          <Pressable
            onPress={() => router.replace("/(auth)/sign-in")}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>Go to sign-in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const inviterLine = invite.inviterName
    ? `${invite.inviterName} invited you to join ${invite.householdName} on eeatly.`
    : `You've been invited to join ${invite.householdName} on eeatly.`;
  const invitedEmail = invite.email.toLowerCase();

  // Branch on session state.
  if (!currentEmail) {
    return (
      <Layout>
        <Heading title="You're invited" body={inviterLine} />
        <PrimaryCta
          label={`Sign in as ${invitedEmail}`}
          icon="mail-outline"
          loading={busy === "send-magic"}
          onPress={() => startMagicLink(invitedEmail)}
        />
        <Text style={styles.fineprint}>
          We'll email a one-tap sign-in link to {invitedEmail}. After
          you tap it, you'll come back here to accept.
        </Text>
      </Layout>
    );
  }

  if (currentEmail.toLowerCase() !== invitedEmail) {
    return (
      <Layout>
        <Heading
          title="Wrong account"
          body={`This invitation is for ${invitedEmail}. You're signed in as ${currentEmail}.`}
        />
        <PrimaryCta
          label={`Sign out and accept as ${invitedEmail}`}
          icon="log-out-outline"
          loading={busy === "switch"}
          onPress={signOutAndContinue}
        />
        <SecondaryCta label="Cancel" onPress={decline} />
      </Layout>
    );
  }

  // Signed in as the invited email — happy path.
  return (
    <Layout>
      <Heading title="You're invited" body={inviterLine} />
      <PrimaryCta
        label="Accept invitation"
        icon="checkmark-circle-outline"
        loading={busy === "accept" || acceptMutation.isPending}
        onPress={() => {
          setBusy("accept");
          acceptMutation.mutate({ token });
        }}
      />
      <SecondaryCta label="Decline" onPress={decline} />
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.container} edges={["bottom", "top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.headingBlock}>
      <View style={styles.iconCircle}>
        <Ionicons name="people-outline" size={28} color="#2f6f58" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </View>
  );
}

function PrimaryCta({
  label,
  icon,
  loading,
  onPress
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.primaryCta,
        loading && styles.disabled,
        pressed && !loading && styles.pressed
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons name={icon} size={18} color="#fff" />
          <Text style={styles.primaryCtaText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function SecondaryCta({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryCta,
        pressed && styles.pressed
      ]}
      accessibilityRole="button"
      hitSlop={6}
    >
      <Text style={styles.secondaryCtaText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 16
  },
  bodyText: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    lineHeight: 21
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111",
    textAlign: "center"
  },
  headingBlock: { alignItems: "center", gap: 14, paddingBottom: 12 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#eef5f1",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryCta: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#2f6f58",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  primaryCtaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },
  secondaryCta: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  secondaryCtaText: { color: "#666", fontSize: 14 },
  fineprint: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  linkButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  linkText: { color: "#2f6f58", fontSize: 14, fontWeight: "500" }
});
