import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { authClient } from "../../../lib/auth/client";
import { useThemeColors } from "../../../lib/design/use-theme-colors";
import { trpc } from "../../../lib/trpc";
import { TopNav } from "../../../components/top-nav";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ErrorScreen,
  LoadingScreen,
  PageTitle,
  Screen,
  SectionLabel
} from "../../../components/ui";

/**
 * Round 18 kitchen — editorial rebuild.
 *
 * TopNav (Kitchen, back chevron, gear) → italic kicker "The" + serif
 * "<name> kitchen." 44pt → mono uppercase eyebrow → inline forest
 * "Invite someone" pill (owner only) → MEMBERS section with avatar
 * + name + (you) + email + Owner chip + joined eyebrow → PENDING
 * INVITATIONS section → centered "Leave kitchen" outline-destructive
 * button with explanatory caption.
 */

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

function formatJoinedEyebrow(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  const month = date.toLocaleString("en-US", { month: "short" });
  return `Joined ${month} ${date.getDate()} · ${date.getFullYear()}`.toUpperCase();
}

function formatInviteEyebrow(sent: string | Date, expires: string | Date): string {
  const sentDate = sent instanceof Date ? sent : new Date(sent);
  const expiresDate = expires instanceof Date ? expires : new Date(expires);
  const fmt = (d: Date) =>
    `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
  return `Sent ${fmt(sentDate)} · expires ${fmt(expiresDate)}`.toUpperCase();
}

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email.trim();
  return source.slice(0, 2).toUpperCase();
}

function kitchenKicker(name: string): { kicker: string; title: string } {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("the ")) {
    return { kicker: "The", title: trimmed.slice(4) + "." };
  }
  if (lower.endsWith(" kitchen")) {
    return { kicker: "The", title: trimmed + "." };
  }
  return { kicker: "Your", title: trimmed + "." };
}

export default function HouseholdScreen() {
  const colors = useThemeColors();
  const current = trpc.households.current.useQuery(undefined, {
    staleTime: 30_000
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadUserId() {
      try {
        const res = await authClient.getSession();
        if (!cancelled) setCurrentUserId(res.data?.user.id ?? null);
      } catch {
        /* swallow */
      }
    }
    void loadUserId();
    return () => {
      cancelled = true;
    };
  }, []);

  const household = current.data;
  const members = household?.members ?? [];
  const ownerRow = members.find((m) => m.role === "owner");
  const isOwner =
    !!currentUserId && !!ownerRow && ownerRow.userId === currentUserId;

  const pending = trpc.households.pendingInvitations.useQuery(undefined, {
    enabled: isOwner,
    staleTime: 30_000
  });

  const utils = trpc.useUtils();
  const cancelMutation = trpc.households.revokeInvitation.useMutation({
    onSuccess: () => utils.households.pendingInvitations.invalidate(),
    onError: (error) =>
      Alert.alert("Couldn't cancel", error.message || "Try again.")
  });

  // R24 — owner-only member removal. The procedure is gated on
  // `householdOwnerProcedure` server-side, so non-owners couldn't
  // even invoke this if we showed the button. We still hide it via
  // `isOwner` for clarity. On success: invalidate `households.current`
  // so the member list repaints without the removed row.
  const removeMemberMutation = trpc.households.removeMember.useMutation({
    onSuccess: async (result) => {
      await utils.households.current.invalidate();
      Alert.alert(
        "Removed",
        `${result.removedUserName} no longer has access to this kitchen.`
      );
    },
    onError: (error) =>
      Alert.alert("Couldn't remove", error.message || "Try again.")
  });

  function confirmRemoveMember(memberName: string, memberUserId: string) {
    Alert.alert(
      `Remove ${memberName}?`,
      `They'll lose access to this kitchen. Their recipes stay credited to them as "Former member."`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMemberMutation.mutate({ targetUserId: memberUserId })
        }
      ]
    );
  }

  const leaveMutation = trpc.households.leaveHousehold.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.households.current.invalidate(),
        utils.dashboard.meals.invalidate(),
        utils.plans.list.invalidate(),
        utils.search.meals.invalidate()
      ]);
      Alert.alert(
        "Left the kitchen",
        `You're no longer a member of ${result.householdName}. Your recipes stay credited to you as "Former member."`,
        [{ text: "OK", onPress: () => router.replace("/(authed)/home") }]
      );
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      if (reason === "SOLE_OWNER") {
        Alert.alert(
          "You're the only owner",
          "Transfer ownership before leaving, or delete the kitchen. Reach out to support for help — ownership transfer is on the roadmap."
        );
        return;
      }
      Alert.alert("Couldn't leave", error.message || "Try again.");
    }
  });

  function confirmLeave(householdName: string) {
    Alert.alert(
      `Leave ${householdName}?`,
      'Your recipes stay credited to you as "Former member." You\'ll land in a fresh personal kitchen.',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave kitchen",
          style: "destructive",
          onPress: () => leaveMutation.mutate()
        }
      ]
    );
  }

  function confirmCancel(invitationId: string, email: string) {
    Alert.alert(
      `Cancel invitation to ${email}?`,
      "They won't be able to use the existing link.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel invitation",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ invitationId })
        }
      ]
    );
  }

  if (current.isPending) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Kitchen" back />
        <LoadingScreen />
      </Screen>
    );
  }

  if (!household) {
    return (
      <Screen edges={["top", "bottom"]}>
        <TopNav title="Kitchen" back />
        <ErrorScreen
          title="Kitchen not loaded"
          body="Try again or head back to home."
        />
      </Screen>
    );
  }

  const { kicker, title } = kitchenKicker(household.name);
  const memberEyebrow =
    household.memberCount === 1
      ? "Just you for now"
      : `${household.memberCount} members`;

  return (
    <Screen edges={["top", "bottom"]}>
      <TopNav title="Kitchen" back />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={current.isFetching && !current.isPending}
            onRefresh={() => {
              current.refetch();
              if (isOwner) pending.refetch();
            }}
            tintColor={colors.forest}
          />
        }
      >
        <View style={{ paddingTop: 8, marginBottom: 22 }}>
          <PageTitle
            title={title}
            size="md"
            kicker={kicker}
            eyebrow={memberEyebrow.toUpperCase()}
          />
        </View>

        {isOwner ? (
          <View style={{ marginBottom: 28 }}>
            <Link href="/(authed)/household/invite" asChild>
              <Pressable>
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={
                    <Ionicons
                      name="person-add-outline"
                      size={16}
                      color={colors.forestText}
                    />
                  }
                >
                  Invite someone
                </Button>
              </Pressable>
            </Link>
          </View>
        ) : null}

        <SectionLabel>Members</SectionLabel>
        <Card style={{ marginBottom: 22, padding: 16 }}>
          <View style={{ gap: 18 }}>
            {members.map((m) => {
              const isMe = currentUserId === m.userId;
              // R24 — show "Remove" only for OTHER members when the
              // viewer is the owner. Self-removal lives on the
              // "Leave kitchen" button at the bottom and uses the
              // `leaveHousehold` procedure (with the SOLE_OWNER guard).
              const canRemove = isOwner && !isMe && m.role !== "owner";
              return (
                <View
                  key={m.userId}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12
                  }}
                >
                  <Avatar size="md" initials={initialsFor(m.name, m.email)} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                      <Text
                        className="font-body-semibold text-body-lg text-ink dark:text-ink-dark"
                        style={{ letterSpacing: -0.1, flex: 1 }}
                        numberOfLines={1}
                      >
                        {m.name}
                      </Text>
                      {isMe ? (
                        <Text className="font-body text-chip text-ink-3 dark:text-ink-3-dark">
                          (you)
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      className="font-mono text-eyebrow text-ink-3 dark:text-ink-3-dark"
                      style={{ letterSpacing: 0.4 }}
                      numberOfLines={1}
                    >
                      {m.email}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 6,
                        flexWrap: "wrap"
                      }}
                    >
                      {m.role === "owner" ? <Chip tone="sage">Owner</Chip> : null}
                      <Text
                        className="font-mono text-eyebrow-xs text-ink-3 dark:text-ink-3-dark uppercase"
                        style={{ letterSpacing: 0.6 }}
                      >
                        {formatJoinedEyebrow(m.joinedAt)}
                      </Text>
                    </View>
                  </View>
                  {canRemove ? (
                    <Pressable
                      onPress={() => confirmRemoveMember(m.name, m.userId)}
                      disabled={removeMemberMutation.isPending}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.name}`}
                      style={{ padding: 4 }}
                    >
                      <Text
                        style={{
                          fontFamily: "Geist_600SemiBold",
                          fontSize: 13,
                          color: colors.danger,
                          opacity: removeMemberMutation.isPending ? 0.5 : 1
                        }}
                      >
                        Remove
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>

        {isOwner ? (
          <>
            <SectionLabel>Pending invitations</SectionLabel>
            {pending.isPending ? (
              <ActivityIndicator color={colors.forest} />
            ) : pending.data && pending.data.length > 0 ? (
              <View style={{ gap: 10, marginBottom: 28 }}>
                {pending.data.map((p) => (
                  <Card key={p.id} style={{ padding: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          className="font-body-semibold text-body-md text-ink dark:text-ink-dark"
                          style={{ letterSpacing: -0.1 }}
                          numberOfLines={1}
                        >
                          {p.email}
                        </Text>
                        <Text
                          className="font-mono text-eyebrow-xs text-ink-3 dark:text-ink-3-dark uppercase mt-1"
                          style={{ letterSpacing: 0.5 }}
                        >
                          {formatInviteEyebrow(p.createdAt, p.expiresAt)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => confirmCancel(p.id, p.email)}
                        disabled={cancelMutation.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel invitation to ${p.email}`}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 99,
                          backgroundColor: colors.dangerSoft,
                          opacity: cancelMutation.isPending ? 0.5 : 1
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Geist_600SemiBold",
                            fontSize: 12.5,
                            color: colors.danger,
                            letterSpacing: -0.05
                          }}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Text className="font-display-italic text-body-md text-ink-3 dark:text-ink-3-dark mb-7">
                No pending invitations.
              </Text>
            )}
          </>
        ) : null}

        <View style={{ alignItems: "center", marginTop: 16 }}>
          <Button
            variant="outline-destructive"
            size="sm"
            onPress={() => confirmLeave(household.name)}
            disabled={leaveMutation.isPending}
            loading={leaveMutation.isPending}
          >
            Leave kitchen
          </Button>
          <Text
            className="font-body text-body-sm text-ink-3 dark:text-ink-3-dark text-center mt-3"
            style={{ maxWidth: 280, lineHeight: 19 }}
          >
            Your recipes stay credited to you. You&apos;ll land in a fresh
            personal kitchen.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
