import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../lib/auth/client";
import { setPendingInvite } from "../../lib/auth/pending-invite";
import { clearSessionToken } from "../../lib/auth/session";
import { trpc } from "../../lib/trpc";
import {
  Button,
  Card,
  CardBody,
  ErrorScreen,
  LoadingScreen
} from "../../components/ui";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Round 17 invite-accept — NativeWind rebuild.
 *
 * Sits outside `(authed)` so invitees can land here while signed
 * out. Three states (signed out / signed in as invited / signed
 * in as someone else) drive different CTAs. R15.5 merge preview
 * is preserved.
 *
 * R19.7: migrated off the R17 compat aliases (`bg-background`,
 * `text-foreground`, `text-primary`, `bg-primary-muted`,
 * `text-destructive`) onto the R19 redesign tokens with `dark:`
 * variants. The compat aliases in `tailwind.config.js` deliberately
 * do NOT have dark siblings — this screen was the last place still
 * relying on them. Inline-hex icon / indicator colors now read from
 * `useThemeColors()` so they invert with system appearance.
 */

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

export default function InviteAcceptScreen() {
  const colors = useThemeColors();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  const [currentEmail, setCurrentEmail] = useState<string | null | undefined>(
    undefined
  );
  const [busy, setBusy] = useState<
    "send-magic" | "accept" | "switch" | null
  >(null);

  const utils = trpc.useUtils();
  const inviteQuery = trpc.households.invitationByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, staleTime: 60_000 }
  );

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

  const [preview, setPreview] = useState<{
    mealsToMerge: number;
    logsToMerge: number;
    willDissolveCurrentHousehold: boolean;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function mapAcceptError(error: unknown): string {
    const reason = getCauseReason(error);
    if (reason === "INVITATION_NOT_FOUND")
      return "This invitation isn't valid anymore. Ask for a new one.";
    if (reason === "INVITATION_EXPIRED")
      return "This invitation has expired. Ask for a new one.";
    if (reason === "INVITATION_ALREADY_USED")
      return "This invitation has already been used.";
    if (reason === "INVITATION_EMAIL_MISMATCH")
      return "This invitation is for a different email address.";
    if (reason === "OWNERSHIP_TRANSFER_REQUIRED")
      return "You own a household with members. Transfer ownership or remove members before joining a new one.";
    if (reason === "MEAL_NAME_COLLISION")
      return "Some of your meal names collide with the new kitchen's. Rename them and try again.";
    return (
      (error as { message?: string }).message ??
      "Couldn't accept the invitation."
    );
  }

  const acceptMutation = trpc.households.acceptInvitation.useMutation({
    onSuccess: async (result) => {
      setBusy(null);
      if (result.kind === "preview") return;
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
      Alert.alert("Couldn't accept", mapAcceptError(error));
    }
  });

  const previewMutation = trpc.households.acceptInvitation.useMutation({
    onSuccess: (result) => {
      if (result.kind !== "preview") return;
      setPreview({
        mealsToMerge: result.mealsToMerge,
        logsToMerge: result.logsToMerge,
        willDissolveCurrentHousehold: result.willDissolveCurrentHousehold
      });
      setPreviewError(null);
    },
    onError: (error) => {
      setPreviewError(mapAcceptError(error));
    }
  });

  useEffect(() => {
    if (!token) return;
    if (!currentEmail) return;
    const invite = inviteQuery.data;
    if (!invite) return;
    if (currentEmail.toLowerCase() !== invite.email.toLowerCase()) return;
    if (preview || previewMutation.isPending || previewError) return;
    previewMutation.mutate({ token, dryRun: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmail, inviteQuery.data, token]);

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

  if (!token) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorScreen
          title="Invalid invitation"
          body="This invitation link is missing its token."
        />
      </>
    );
  }

  if (inviteQuery.isPending || currentEmail === undefined) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingScreen />
      </>
    );
  }

  const invite = inviteQuery.data;
  if (!invite || invite.acceptedAt || new Date(invite.expiresAt) < new Date()) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorScreen
          title="Invitation unavailable"
          body={
            invite?.acceptedAt
              ? "This invitation has already been used."
              : invite
                ? "This invitation has expired. Ask the sender for a new one."
                : "We couldn't find this invitation. The link may have been revoked."
          }
        />
        <View className="absolute left-0 right-0 bottom-12 items-center">
          <Button
            variant="secondary"
            onPress={() => router.replace("/(auth)/sign-in")}
          >
            Go to sign-in
          </Button>
        </View>
      </>
    );
  }

  const inviterLine = invite.inviterName
    ? `${invite.inviterName} invited you to join ${invite.householdName} on eeatly.`
    : `You've been invited to join ${invite.householdName} on eeatly.`;
  const invitedEmail = invite.email.toLowerCase();

  return (
    <SafeAreaView
      className="flex-1 bg-cream dark:bg-cream-dark"
      edges={["top", "bottom"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-6 pt-10 gap-4">
        <Heading title="You're invited" body={inviterLine} />

        {!currentEmail ? (
          <View className="gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={busy === "send-magic"}
              leadingIcon={
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={colors.forestText}
                />
              }
              onPress={() => startMagicLink(invitedEmail)}
            >
              {`Sign in as ${invitedEmail}`}
            </Button>
            <Text className="text-small text-ink-2 dark:text-ink-2-dark text-center">
              We&apos;ll email a one-tap sign-in link to {invitedEmail}.
              After you tap it, you&apos;ll come back here to accept.
            </Text>
          </View>
        ) : currentEmail.toLowerCase() !== invitedEmail ? (
          <View className="gap-2">
            <Text className="text-body text-ink-2 dark:text-ink-2-dark text-center">
              This invitation is for{" "}
              <Text className="font-semibold text-ink dark:text-ink-dark">
                {invitedEmail}
              </Text>
              . You&apos;re signed in as{" "}
              <Text className="font-semibold text-ink dark:text-ink-dark">
                {currentEmail}
              </Text>
              .
            </Text>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={busy === "switch"}
              leadingIcon={
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={colors.forestText}
                />
              }
              onPress={signOutAndContinue}
            >
              {`Sign out and accept as ${invitedEmail}`}
            </Button>
            <Button variant="ghost" fullWidth onPress={decline}>
              Cancel
            </Button>
          </View>
        ) : (
          <View className="gap-3">
            {previewMutation.isPending && !preview ? (
              <View className="flex-row items-center justify-center gap-2 py-4">
                <ActivityIndicator color={colors.forest} />
                <Text className="text-small text-ink-2 dark:text-ink-2-dark">
                  Checking what would merge…
                </Text>
              </View>
            ) : preview &&
              (preview.mealsToMerge > 0 ||
                preview.logsToMerge > 0 ||
                preview.willDissolveCurrentHousehold) ? (
              <Card variant="outlined">
                <CardBody>
                  <View className="flex-row items-center gap-2 mb-2">
                    <Ionicons
                      name="git-merge-outline"
                      size={18}
                      color={colors.forest}
                    />
                    <Text className="text-caption-strong font-semibold uppercase tracking-wider text-forest dark:text-forest-dark">
                      What happens when you accept
                    </Text>
                  </View>
                  <Text className="text-body text-ink dark:text-ink-dark leading-5">
                    {preview.mealsToMerge > 0
                      ? `${preview.mealsToMerge} of your meals`
                      : "No meals"}
                    {preview.logsToMerge > 0
                      ? ` and ${preview.logsToMerge} cook ${preview.logsToMerge === 1 ? "log" : "logs"}`
                      : ""}{" "}
                    move into {invite.householdName}.
                    {preview.willDissolveCurrentHousehold
                      ? " Your current personal kitchen will be dissolved."
                      : ""}
                  </Text>
                </CardBody>
              </Card>
            ) : null}
            {previewError ? (
              <Text className="text-caption text-danger dark:text-danger-dark text-center">
                {previewError}
              </Text>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={busy === "accept" || acceptMutation.isPending}
              leadingIcon={
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.forestText}
                />
              }
              onPress={() => {
                setBusy("accept");
                acceptMutation.mutate({ token });
              }}
            >
              {preview &&
              (preview.mealsToMerge > 0 ||
                preview.logsToMerge > 0 ||
                preview.willDissolveCurrentHousehold)
                ? "Accept and merge"
                : "Accept invitation"}
            </Button>
            <Button variant="ghost" fullWidth onPress={decline}>
              Decline
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  const colors = useThemeColors();
  return (
    <View className="items-center gap-3 pb-4">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-sage-bg dark:bg-sage-bg-dark">
        <Ionicons name="people-outline" size={36} color={colors.forest} />
      </View>
      <Text className="text-heading-1 font-bold text-ink dark:text-ink-dark text-center">
        {title}
      </Text>
      <Text className="text-body text-ink-2 dark:text-ink-2-dark text-center leading-6">
        {body}
      </Text>
    </View>
  );
}
