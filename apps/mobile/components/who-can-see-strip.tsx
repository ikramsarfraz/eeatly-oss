import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { trpc } from "../lib/trpc";
import type { ThemeColors } from "../lib/design/tokens";
import { useThemeColors } from "../lib/design/use-theme-colors";

/**
 * R33 — mobile mirror of the web "Who can see this" strip
 * (apps/web/components/sharing/who-can-see-strip.tsx).
 *
 * R32 made recipe/plan sharing grant-based + private-by-default. Three
 * states, matching the web component exactly:
 *   - Owner / admin, private → lock + "Only you can see this".
 *   - Owner / admin, shared  → people + "Shared with <names>" + Live.
 *   - Grantee (read-only)    → "Shared by <owner> · Live · View only"
 *                              + "Save a copy".
 *
 * Copy strings are reused verbatim from the web component so cross-platform
 * language stays identical (web's single em dash is swapped for a comma per
 * the repo's no-em-dash copy rule). Interactive grant management (the web
 * Share sheet: add people, roles, revoke) stays on the web this round, so the
 * owner states are display-only; the grantee "Save a copy" action is wired
 * because `sharing.saveCopy` already exists.
 */

type Styles = ReturnType<typeof makeStyles>;

export function WhoCanSeeStrip({
  itemType,
  itemId,
  canManageSharing,
  ownerName
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  /** Owner / admin → display-only visibility indicator; else grantee view. */
  canManageSharing: boolean;
  /** Creator's display name, for the grantee "Shared by X" line. */
  ownerName?: string | null;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (canManageSharing) {
    return (
      <OwnerStrip itemType={itemType} itemId={itemId} styles={styles} colors={colors} />
    );
  }
  return (
    <GranteeStrip
      itemType={itemType}
      itemId={itemId}
      ownerName={ownerName ?? null}
      styles={styles}
      colors={colors}
    />
  );
}

function LivePill({ styles }: { styles: Styles }) {
  return (
    <View style={styles.livePill}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>Live</Text>
    </View>
  );
}

function OwnerStrip({
  itemType,
  itemId,
  styles,
  colors
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  styles: Styles;
  colors: ThemeColors;
}) {
  // Mirrors the web OwnerStrip: grant presence (not a flag) decides shared
  // vs private, and the first two grantee names are shown with a "+N" tail.
  const grantsQuery = trpc.sharing.grantsForItem.useQuery(
    { itemType, itemId },
    { staleTime: 30_000 }
  );
  const grants = grantsQuery.data ?? [];
  const shared = grants.length > 0;
  const names = grants
    .map((g) => g.name?.trim() || g.email.split("@")[0])
    .slice(0, 2)
    .join(", ");
  const extra = grants.length > 2 ? ` +${grants.length - 2}` : "";

  return (
    <View style={styles.strip}>
      <View
        style={[styles.iconChip, shared ? styles.iconChipShared : styles.iconChipPrivate]}
      >
        <Ionicons
          name={shared ? "people-outline" : "lock-closed-outline"}
          size={18}
          color={shared ? colors.forest : colors.ink3}
        />
      </View>
      <View style={styles.body}>
        {shared ? (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{`Shared with ${names}${extra}`}</Text>
              <LivePill styles={styles} />
            </View>
            <Text style={styles.sub}>
              They see your latest version. Your edits update their copy, they
              can&apos;t change yours.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Only you can see this</Text>
            <Text style={styles.sub}>
              {`This ${itemType} is private. Share it to give someone a live copy.`}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function GranteeStrip({
  itemType,
  itemId,
  ownerName,
  styles,
  colors
}: {
  itemType: "recipe" | "plan";
  itemId: string;
  ownerName: string | null;
  styles: Styles;
  colors: ThemeColors;
}) {
  // The detail screen never pre-seeds a saved-copy id (web doesn't either), so
  // the button starts as "Save a copy" and flips to "Open my copy" once the
  // fork lands. Save feedback uses Alert to match the rest of the mobile app
  // (share sheet, plan screen) while keeping the web copy verbatim.
  const [savedId, setSavedId] = useState<string | null>(null);
  const save = trpc.sharing.saveCopy.useMutation({
    onSuccess: (res) => {
      setSavedId(res.newItemId);
      Alert.alert("Saved to your library");
    },
    onError: (error) =>
      Alert.alert(
        "Couldn't save copy",
        (error as { message?: string }).message ?? "Try again."
      )
  });

  const copyHref = (id: string) =>
    itemType === "recipe"
      ? `/(authed)/meal/${id}`
      : `/(authed)/plans/${id}`;

  return (
    <View style={styles.strip}>
      <View style={[styles.iconChip, styles.iconChipShared]}>
        <Ionicons name="people-outline" size={18} color={colors.forest} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{`Shared by ${ownerName ?? "someone"}`}</Text>
          <LivePill styles={styles} />
          <Text style={styles.viewOnly}>· View only</Text>
        </View>
        <Text style={styles.sub}>
          You see their latest version as they edit. Save a copy to make it your
          own.
        </Text>
        {savedId ? (
          <Pressable
            onPress={() => router.push(copyHref(savedId) as never)}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open my copy"
          >
            <Ionicons name="copy-outline" size={15} color={colors.forest} />
            <Text style={styles.secondaryBtnText}>Open my copy</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => save.mutate({ itemType, itemId })}
            disabled={save.isPending}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || save.isPending) && styles.pressed
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save a copy"
          >
            {save.isPending ? (
              <ActivityIndicator size="small" color={colors.forestText} />
            ) : (
              <Ionicons name="copy-outline" size={15} color={colors.forestText} />
            )}
            <Text style={styles.primaryBtnText}>Save a copy</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    strip: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 22
    },
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center"
    },
    iconChipShared: { backgroundColor: colors.sageBg },
    iconChipPrivate: { backgroundColor: colors.creamSoft },
    body: { flex: 1, gap: 4 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8
    },
    title: { fontSize: 14, fontWeight: "600", color: colors.ink },
    sub: { fontSize: 12.5, color: colors.ink3, lineHeight: 18 },
    livePill: { flexDirection: "row", alignItems: "center", gap: 4 },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.forest
    },
    liveText: {
      fontSize: 9.5,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.forest
    },
    viewOnly: {
      fontSize: 9.5,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.ink3
    },
    primaryBtn: {
      marginTop: 8,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.forest
    },
    primaryBtnText: { color: colors.forestText, fontSize: 14, fontWeight: "600" },
    secondaryBtn: {
      marginTop: 8,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    secondaryBtnText: { color: colors.forest, fontSize: 14, fontWeight: "500" },
    pressed: { opacity: 0.85 }
  });
}
