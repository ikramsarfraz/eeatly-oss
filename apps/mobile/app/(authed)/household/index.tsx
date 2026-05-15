import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, Stack } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../../lib/auth/client";
import { trpc } from "../../../lib/trpc";

/**
 * Round 14 Task 5 — household management screen.
 *
 * Surfaces:
 *   - Kitchen name + member count
 *   - Members list with owner badge + join date
 *   - Pending invitations (owner-only) with per-row Cancel
 *   - "Invite someone" CTA (visible only to the owner)
 *
 * Auth nuance: `households.pendingInvitations` is `householdOwnerProcedure`,
 * so a non-owner gets `NOT_HOUSEHOLD_OWNER`. We probe the user's role
 * from `households.current` and only enable the pending-invites query
 * + invite CTA when they're owner. Non-owners see members only.
 *
 * `households.leaveHousehold` doesn't exist yet (see Round 14 follow-up
 * notes). The "Leave kitchen" affordance is therefore intentionally
 * omitted on mobile this round — implementing it would require a backend
 * procedure, which R14 disallowed. Logged as an R14.5 follow-up.
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

  // Pending invites — only request when owner; otherwise the procedure
  // would 403 (FORBIDDEN_ROLE) and we'd surface a confusing error.
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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Kitchen", headerBackTitle: "Back" }} />

      {current.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2f6f58" />
        </View>
      ) : !household ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Kitchen not loaded</Text>
          <Pressable
            onPress={() => router.replace("/(authed)/home")}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.linkText}>Back to home</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={current.isFetching && !current.isPending}
              onRefresh={() => {
                current.refetch();
                if (isOwner) pending.refetch();
              }}
              tintColor="#2f6f58"
            />
          }
        >
          <View style={styles.headerBlock}>
            <Text style={styles.kitchenName}>{household.name}</Text>
            <Text style={styles.kitchenMeta}>
              {household.memberCount === 1
                ? "Just you for now"
                : `${household.memberCount} members`}
            </Text>
          </View>

          {isOwner ? (
            <Link href="/(authed)/household/invite" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.inviteButton,
                  pressed && styles.pressed
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.inviteButtonText}>Invite someone</Text>
              </Pressable>
            </Link>
          ) : null}

          <Text style={styles.sectionHeading}>Members</Text>
          <View style={styles.list}>
            {members.map((m) => {
              const isMe = currentUserId === m.userId;
              const canRemove =
                isOwner && !isMe && m.role !== "owner";
              return (
                <View key={m.userId} style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.name}
                      {isMe ? <Text style={styles.youTag}> (you)</Text> : null}
                    </Text>
                    <Text style={styles.memberEmail} numberOfLines={1}>
                      {m.email}
                    </Text>
                    <View style={styles.metaLine}>
                      {m.role === "owner" ? (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>Owner</Text>
                        </View>
                      ) : null}
                      <Text style={styles.joinedText}>
                        Joined {formatJoined(m.joinedAt)}
                      </Text>
                    </View>
                  </View>
                  {canRemove ? (
                    <Pressable
                      onPress={() => confirmRemove(m.userId, m.name)}
                      hitSlop={6}
                      disabled={removeMutation.isPending}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.pressed,
                        removeMutation.isPending && styles.disabled
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.name}`}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {isOwner ? (
            <>
              <Text style={styles.sectionHeading}>Pending invitations</Text>
              {pending.isPending ? (
                <ActivityIndicator color="#2f6f58" />
              ) : pending.data && pending.data.length > 0 ? (
                <View style={styles.list}>
                  {pending.data.map((p) => (
                    <View key={p.id} style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {p.email}
                        </Text>
                        <Text style={styles.joinedText}>
                          Sent {formatJoined(p.createdAt)} · expires{" "}
                          {formatJoined(p.expiresAt)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => confirmCancel(p.id, p.email)}
                        hitSlop={6}
                        disabled={cancelMutation.isPending}
                        style={({ pressed }) => [
                          styles.removeButton,
                          pressed && styles.pressed,
                          cancelMutation.isPending && styles.disabled
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.removeText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  No pending invitations.
                </Text>
              )}
            </>
          ) : null}

          <View style={styles.footerSpace}>
            <Text style={styles.fineprint}>
              To leave this kitchen, open eeatly.app in your browser and use
              the Leave option on settings.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
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
  scroll: {
    padding: 16,
    paddingBottom: 48,
    gap: 14
  },
  headerBlock: { gap: 4, paddingBottom: 4 },
  kitchenName: { fontSize: 24, fontWeight: "600", color: "#111" },
  kitchenMeta: { fontSize: 13, color: "#666" },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#2f6f58"
  },
  inviteButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6
  },
  list: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  rowBody: { flex: 1, gap: 3 },
  memberName: { fontSize: 15, fontWeight: "500", color: "#111" },
  memberEmail: { fontSize: 13, color: "#555" },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2
  },
  joinedText: { fontSize: 11, color: "#888" },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#eef5f1",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cfe1d7"
  },
  ownerBadgeText: {
    fontSize: 10.5,
    color: "#1f4a3b",
    fontWeight: "600",
    letterSpacing: 0.4
  },
  youTag: { fontSize: 13, color: "#888", fontWeight: "400" },
  removeButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f0c5c2",
    backgroundColor: "#fdecea"
  },
  removeText: { color: "#b91c1c", fontSize: 13, fontWeight: "500" },
  emptyText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    paddingVertical: 8
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#111" },
  linkButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  linkText: { color: "#2f6f58", fontSize: 14, fontWeight: "500" },
  footerSpace: {
    marginTop: 20,
    paddingHorizontal: 4
  },
  fineprint: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    lineHeight: 17
  }
});
