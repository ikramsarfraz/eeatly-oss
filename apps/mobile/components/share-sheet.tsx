import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { trpc } from "../lib/trpc";

/**
 * Round 14 Task 1 — recipe share sheet.
 *
 * Three internal phases driven off a `state` machine:
 *   - "options"  — three buttons (share text, create link, manage links).
 *                  "Manage links" only shows when active shares exist.
 *   - "created"  — the URL we just minted (or an existing one we
 *                  re-surfaced; the service is idempotent per meal). Copy,
 *                  WhatsApp, and Share actions live here.
 *   - "manage"   — list of active shares with per-row Revoke.
 *
 * Error mapping:
 *   - UPGRADE_REQUIRED → inline upgrade copy + web /pricing link
 *   - RATE_LIMITED     → Alert
 *   - other            → Alert with the server's user-facing message
 *
 * No new dep. Uses RN's built-in `Share.share` (same pattern as R13
 * Task 5's recipe share button) and the R13 Task 6 expo-clipboard.
 */

export type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  mealId: string;
  mealName: string;
  recipeText: string | null;
  recipeSourceUrl: string | null;
};

type Phase =
  | { kind: "options" }
  | { kind: "created"; url: string; shareId: string }
  | { kind: "manage" }
  | { kind: "upgrade" };

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}

function whatsappHref(mealName: string, url: string): string {
  // wa.me — universal WhatsApp deep link. Mirrors the web's format
  // (apps/web/components/shares/share-link-dialog.tsx whatsappHref).
  // Falls back to web WhatsApp if the app isn't installed.
  const message = `Recipe for ${mealName}: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function ShareSheet({
  visible,
  onClose,
  mealId,
  mealName,
  recipeText,
  recipeSourceUrl
}: ShareSheetProps) {
  const utils = trpc.useUtils();
  const [phase, setPhase] = useState<Phase>({ kind: "options" });

  // Reset phase whenever the sheet re-opens, otherwise stale "created"
  // state from a previous open hangs around.
  useEffect(() => {
    if (visible) setPhase({ kind: "options" });
  }, [visible]);

  const listQuery = trpc.shares.listForMeal.useQuery(
    { mealId },
    { enabled: visible, staleTime: 30_000 }
  );

  const createMutation = trpc.shares.create.useMutation({
    onSuccess: async (result) => {
      await utils.shares.listForMeal.invalidate({ mealId });
      setPhase({ kind: "created", url: result.url, shareId: result.shareId });
    },
    onError: (error) => {
      const reason = getCauseReason(error);
      if (reason === "UPGRADE_REQUIRED") {
        setPhase({ kind: "upgrade" });
        return;
      }
      const message =
        reason === "RATE_LIMITED"
          ? "You've created a lot of share links today. Try again later."
          : reason === "MEAL_ARCHIVED"
            ? "This meal was archived. Restore it on the web to share."
            : error.message || "Couldn't create the share link. Try again.";
      Alert.alert("Couldn't share", message);
    }
  });

  const revokeMutation = trpc.shares.revoke.useMutation({
    onSuccess: () => utils.shares.listForMeal.invalidate({ mealId }),
    onError: (error) =>
      Alert.alert("Couldn't revoke", error.message || "Try again.")
  });

  const recipeText_ = useMemo(() => {
    const parts = [mealName];
    if (recipeText) parts.push("", recipeText);
    if (recipeSourceUrl) parts.push("", `Source: ${recipeSourceUrl}`);
    return parts.join("\n");
  }, [mealName, recipeText, recipeSourceUrl]);

  async function shareRecipeText() {
    onClose();
    try {
      await Share.share({ message: recipeText_, title: mealName });
    } catch {
      /* user cancelled */
    }
  }

  function createLink() {
    createMutation.mutate({ mealId });
  }

  async function copyUrl(url: string) {
    await Clipboard.setStringAsync(url);
    Alert.alert("Copied", "Share link copied to clipboard.");
  }

  async function openWhatsApp(url: string) {
    const target = whatsappHref(mealName, url);
    try {
      await Linking.openURL(target);
    } catch {
      Alert.alert("Couldn't open WhatsApp", "Open WhatsApp and paste the link.");
    }
  }

  async function shareLink(url: string) {
    try {
      await Share.share({
        message: `Recipe for ${mealName}: ${url}`,
        title: mealName
      });
    } catch {
      /* cancelled */
    }
  }

  function confirmRevoke(shareId: string) {
    Alert.alert(
      "Revoke this link?",
      "Anyone with the URL won't be able to view the recipe anymore.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => revokeMutation.mutate({ shareId })
        }
      ]
    );
  }

  const shares = listQuery.data ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => null}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {phase.kind === "options" ? (
            <OptionsView
              onShareText={shareRecipeText}
              onCreateLink={createLink}
              onManage={() => setPhase({ kind: "manage" })}
              hasShares={shares.length > 0}
              creating={createMutation.isPending}
            />
          ) : phase.kind === "created" ? (
            <CreatedView
              url={phase.url}
              onCopy={() => copyUrl(phase.url)}
              onWhatsApp={() => openWhatsApp(phase.url)}
              onShare={() => shareLink(phase.url)}
              onDone={onClose}
            />
          ) : phase.kind === "manage" ? (
            <ManageView
              shares={shares}
              loading={listQuery.isPending}
              revokingId={revokeMutation.variables?.shareId ?? null}
              onRevoke={confirmRevoke}
              onBack={() => setPhase({ kind: "options" })}
            />
          ) : (
            <UpgradeView onClose={onClose} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OptionsView({
  onShareText,
  onCreateLink,
  onManage,
  hasShares,
  creating
}: {
  onShareText: () => void;
  onCreateLink: () => void;
  onManage: () => void;
  hasShares: boolean;
  creating: boolean;
}) {
  return (
    <View style={styles.bodyPad}>
      <Text style={styles.sheetTitle}>Share this recipe</Text>
      <SheetOption
        icon="share-outline"
        label="Share recipe text"
        sublabel="Send the recipe via WhatsApp, Messages, etc."
        onPress={onShareText}
      />
      <SheetOption
        icon="link-outline"
        label="Create a link anyone can view"
        sublabel="Public share link — revoke anytime."
        onPress={onCreateLink}
        loading={creating}
      />
      {hasShares ? (
        <SheetOption
          icon="settings-outline"
          label="Manage existing links"
          sublabel="See or revoke share links for this recipe."
          onPress={onManage}
        />
      ) : null}
    </View>
  );
}

function CreatedView({
  url,
  onCopy,
  onWhatsApp,
  onShare,
  onDone
}: {
  url: string;
  onCopy: () => void;
  onWhatsApp: () => void;
  onShare: () => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.bodyPad}>
      <Text style={styles.sheetTitle}>Share link ready</Text>
      <Text style={styles.sheetBody}>
        Anyone with this link can view the recipe. You can revoke it
        anytime from "Manage links."
      </Text>
      <View style={styles.urlBox}>
        <Ionicons name="link-outline" size={16} color="#2f6f58" />
        <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
          {url}
        </Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionPrimary,
            pressed && styles.pressed
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="copy-outline" size={18} color="#fff" />
          <Text style={styles.actionPrimaryText}>Copy</Text>
        </Pressable>
        <Pressable
          onPress={onWhatsApp}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionSecondary,
            pressed && styles.pressed
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="logo-whatsapp" size={18} color="#2f6f58" />
          <Text style={styles.actionSecondaryText}>WhatsApp</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [
          styles.fullWidthSecondary,
          pressed && styles.pressed
        ]}
        accessibilityRole="button"
      >
        <Ionicons name="share-outline" size={18} color="#2f6f58" />
        <Text style={styles.actionSecondaryText}>More share options…</Text>
      </Pressable>
      <Pressable
        onPress={onDone}
        style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

function ManageView({
  shares,
  loading,
  revokingId,
  onRevoke,
  onBack
}: {
  shares: Array<{ id: string; url: string; createdAt: Date | string }>;
  loading: boolean;
  revokingId: string | null;
  onRevoke: (shareId: string) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.bodyPad}>
      <View style={styles.manageHeader}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to share options"
        >
          <Ionicons name="chevron-back" size={22} color="#2f6f58" />
        </Pressable>
        <Text style={[styles.sheetTitle, styles.manageTitle]}>
          Share links
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#2f6f58" />
      ) : shares.length === 0 ? (
        <Text style={styles.emptyText}>
          No share links for this recipe yet.
        </Text>
      ) : (
        <ScrollView style={styles.manageList}>
          {shares.map((s) => (
            <View key={s.id} style={styles.manageRow}>
              <View style={styles.manageRowBody}>
                <Text style={styles.manageRowUrl} numberOfLines={1} ellipsizeMode="middle">
                  {s.url}
                </Text>
                <Text style={styles.manageRowMeta}>
                  Created{" "}
                  {new Date(s.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </Text>
              </View>
              <Pressable
                onPress={() => onRevoke(s.id)}
                disabled={revokingId === s.id}
                style={({ pressed }) => [
                  styles.revokeButton,
                  pressed && styles.pressed,
                  revokingId === s.id && styles.disabled
                ]}
                accessibilityRole="button"
              >
                {revokingId === s.id ? (
                  <ActivityIndicator color="#b91c1c" size="small" />
                ) : (
                  <Text style={styles.revokeText}>Revoke</Text>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UpgradeView({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.bodyPad}>
      <Ionicons
        name="sparkles-outline"
        size={28}
        color="#2f6f58"
        style={styles.upgradeIcon}
      />
      <Text style={styles.sheetTitle}>Share links are a Plus feature</Text>
      <Text style={styles.sheetBody}>
        Upgrade on the web to create public share links. Sharing recipe
        text via the OS share sheet stays free.
      </Text>
      <Pressable
        onPress={() => Linking.openURL("https://eeatly.app/pricing")}
        style={({ pressed }) => [
          styles.actionButton,
          styles.actionPrimary,
          styles.upgradeButton,
          pressed && styles.pressed
        ]}
      >
        <Text style={styles.actionPrimaryText}>See Plus on the web</Text>
      </Pressable>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Text style={styles.doneText}>Close</Text>
      </Pressable>
    </View>
  );
}

function SheetOption({
  icon,
  label,
  sublabel,
  onPress,
  loading
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.optionRow,
        pressed && styles.optionRowPressed,
        loading && styles.disabled
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.optionIconWrap}>
        {loading ? (
          <ActivityIndicator size="small" color="#2f6f58" />
        ) : (
          <Ionicons name={icon} size={22} color="#2f6f58" />
        )}
      </View>
      <View style={styles.optionBody}>
        <Text style={styles.optionLabel}>{label}</Text>
        {sublabel ? <Text style={styles.optionSublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#aaa" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
    maxHeight: "85%"
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 10
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#dcd9d2"
  },
  bodyPad: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111"
  },
  sheetBody: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    backgroundColor: "#fff"
  },
  optionRowPressed: { backgroundColor: "#f3f1ea" },
  optionIconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  optionBody: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: "500", color: "#111" },
  optionSublabel: { fontSize: 12, color: "#777" },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eef5f1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cfe1d7"
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    color: "#1f4a3b",
    fontFamily: "Menlo"
  },
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: "#2f6f58"
  },
  actionPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  actionSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cfd6cf",
    backgroundColor: "#fff"
  },
  actionSecondaryText: {
    color: "#2f6f58",
    fontSize: 14,
    fontWeight: "500"
  },
  fullWidthSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfd6cf",
    backgroundColor: "#fff"
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  doneRow: {
    alignItems: "center",
    paddingTop: 4
  },
  doneText: {
    color: "#666",
    fontSize: 14
  },
  manageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  manageTitle: { flex: 1, textAlign: "center" },
  manageList: {
    maxHeight: 280
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc"
  },
  manageRowBody: { flex: 1, gap: 2 },
  manageRowUrl: {
    fontSize: 13,
    color: "#222",
    fontFamily: "Menlo"
  },
  manageRowMeta: { fontSize: 11, color: "#888" },
  revokeButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f0c5c2",
    backgroundColor: "#fdecea"
  },
  revokeText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "500"
  },
  emptyText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 24
  },
  upgradeIcon: { alignSelf: "center" },
  upgradeButton: {
    flex: undefined,
    minWidth: 200,
    alignSelf: "stretch",
    marginTop: 4
  }
});
