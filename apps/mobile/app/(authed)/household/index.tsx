import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack } from "expo-router";
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
import { trpc } from "../../../lib/trpc";
import {
  Avatar,
  Button,
  Card,
  ErrorScreen,
  LoadingScreen,
  Screen,
  SectionHeader,
  Tag
} from "../../../components/ui";

/**
 * Round 17 household — NativeWind rebuild.
 *
 * Kitchen header card → invite button (owner only) → members list →
 * pending invitations list (owner only) → leave kitchen button.
 *
 * Member rows use the Avatar primitive with deterministic colors so
 * each household member is visually distinguishable.
 */

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

function formatJoined(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function HouseholdScreen() {
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
  const removeMutation = trpc.households.removeMember.useMutation({
    onSuccess: () => {
      utils.households.current.invalidate();
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      Alert.alert(
        "Couldn't remove",
        reason === "CANNOT_REMOVE_SELF"
          ? "Use Leave kitchen on the web to remove yourself."
          : reason === "CANNOT_REMOVE_OWNER"
            ? "You can't remove the owner. Transfer ownership first."
            : error.message || "Try again."
      );
    }
  });

  const cancelMutation = trpc.households.revokeInvitation.useMutation({
    onSuccess: () => utils.households.pendingInvitations.invalidate(),
    onError: (error) =>
      Alert.alert("Couldn't cancel", error.message || "Try again.")
  });

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

  function confirmRemove(targetUserId: string, name: string) {
    Alert.alert(
      `Remove ${name}?`,
      "Their recipes stay in the kitchen; future contributions stop.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMutation.mutate({ targetUserId })
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
      <>
        <Stack.Screen
          options={{
            title: "Kitchen",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <LoadingScreen />
      </>
    );
  }

  if (!household) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Kitchen",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FBF8F1" },
            headerTintColor: "#1A1F1B"
          }}
        />
        <ErrorScreen
          title="Kitchen not loaded"
          body="Try again or head back to home."
        />
      </>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Kitchen",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FBF8F1" },
          headerTintColor: "#1A1F1B",
          headerTitleStyle: { fontWeight: "600" }
        }}
      />
      <ScrollView
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl
            refreshing={current.isFetching && !current.isPending}
            onRefresh={() => {
              current.refetch();
              if (isOwner) pending.refetch();
            }}
            tintColor="#2C5F3F"
          />
        }
      >
        <View className="px-4 pt-4 gap-2">
          <Text className="text-heading-1 font-bold text-foreground">
            {household.name}
          </Text>
          <Text className="text-caption text-foreground-muted">
            {household.memberCount === 1
              ? "Just you for now"
              : `${household.memberCount} members`}
          </Text>
          {isOwner ? (
            <View className="mt-2">
              <Link href="/(authed)/household/invite" asChild>
                <Pressable>
                  <Button
                    variant="primary"
                    size="md"
                    leadingIcon={
                      <Ionicons
                        name="person-add-outline"
                        size={18}
                        color="#FBF8F1"
                      />
                    }
                  >
                    Invite someone
                  </Button>
                </Pressable>
              </Link>
            </View>
          ) : null}
        </View>

        <SectionHeader title="Members" />
        <View className="px-4">
          <Card>
            {members.map((m, i) => {
              const isMe = currentUserId === m.userId;
              const canRemove = isOwner && !isMe && m.role !== "owner";
              return (
                <View
                  key={m.userId}
                  className={`flex-row items-start gap-3 p-3.5 ${
                    i < members.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <Avatar
                    size="md"
                    initials={initialsFor(m.name, m.email)}
                  />
                  <View className="flex-1 gap-0.5">
                    <Text
                      className="text-body font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {m.name}
                      {isMe ? (
                        <Text className="text-caption text-foreground-muted font-normal">
                          {"  "}(you)
                        </Text>
                      ) : null}
                    </Text>
                    <Text
                      className="text-caption text-foreground-muted"
                      numberOfLines={1}
                    >
                      {m.email}
                    </Text>
                    <View className="flex-row items-center flex-wrap gap-1.5 mt-1">
                      {m.role === "owner" ? (
                        <Tag variant="primary">Owner</Tag>
                      ) : null}
                      <Text className="text-small text-foreground-subtle">
                        Joined {formatJoined(m.joinedAt)}
                      </Text>
                    </View>
                  </View>
                  {canRemove ? (
                    <Pressable
                      onPress={() => confirmRemove(m.userId, m.name)}
                      hitSlop={6}
                      disabled={removeMutation.isPending}
                      className={`px-3 py-2 rounded-sm border border-destructive/30 bg-destructive/10 active:opacity-70 ${
                        removeMutation.isPending ? "opacity-50" : ""
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.name}`}
                    >
                      <Text className="text-caption-strong font-semibold text-destructive">
                        Remove
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </View>

        {isOwner ? (
          <>
            <SectionHeader title="Pending invitations" />
            <View className="px-4">
              {pending.isPending ? (
                <ActivityIndicator color="#2C5F3F" />
              ) : pending.data && pending.data.length > 0 ? (
                <Card>
                  {pending.data.map((p, i) => (
                    <View
                      key={p.id}
                      className={`flex-row items-center gap-3 p-3.5 ${
                        i < (pending.data?.length ?? 0) - 1
                          ? "border-b border-border"
                          : ""
                      }`}
                    >
                      <View className="flex-1 gap-0.5">
                        <Text
                          className="text-body text-foreground"
                          numberOfLines={1}
                        >
                          {p.email}
                        </Text>
                        <Text className="text-small text-foreground-muted">
                          Sent {formatJoined(p.createdAt)} · expires{" "}
                          {formatJoined(p.expiresAt)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => confirmCancel(p.id, p.email)}
                        hitSlop={6}
                        disabled={cancelMutation.isPending}
                        className={`px-3 py-2 rounded-sm border border-destructive/30 bg-destructive/10 active:opacity-70 ${
                          cancelMutation.isPending ? "opacity-50" : ""
                        }`}
                        accessibilityRole="button"
                      >
                        <Text className="text-caption-strong font-semibold text-destructive">
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              ) : (
                <Text className="text-caption italic text-foreground-muted px-1">
                  No pending invitations.
                </Text>
              )}
            </View>
          </>
        ) : null}

        <View className="mt-8 px-8 items-center gap-2">
          <Pressable
            onPress={() => confirmLeave(household.name)}
            disabled={leaveMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Leave ${household.name}`}
            className={`min-h-[44px] px-4 py-2.5 rounded-sm border border-destructive/30 bg-destructive/10 active:opacity-70 ${
              leaveMutation.isPending ? "opacity-50" : ""
            }`}
          >
            <Text className="text-caption-strong font-semibold text-destructive">
              {leaveMutation.isPending ? "Leaving…" : "Leave kitchen"}
            </Text>
          </Pressable>
          <Text className="text-small text-foreground-muted text-center max-w-[280px]">
            Your recipes stay credited to you. You&apos;ll land in a fresh
            personal kitchen.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
