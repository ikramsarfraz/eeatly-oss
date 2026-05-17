import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { trpc } from "../../lib/trpc";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Mobile equivalent of the web `UrlPreviewCard`. Fetches OG data via
 * `urlPreview.fetch` and renders a tappable card. Tapping opens the
 * source URL in the system browser via `Linking.openURL`.
 *
 * R19.7: theme-aware. Every color reads from `useThemeColors()` and the
 * StyleSheet is memoised on the palette reference so it only recomputes
 * on appearance change.
 *
 * No `expo-image` — the rest of the app uses plain `<Image>`; not
 * worth pulling in a new dep for one card.
 */
type Props = {
  url: string;
};

export function UrlPreviewCard({ url }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          gap: 10,
          borderRadius: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: "hidden"
        },
        cardPressed: { opacity: 0.85 },
        image: {
          width: 96,
          height: 96,
          backgroundColor: colors.creamSoft
        },
        imagePlaceholder: {
          alignItems: "center",
          justifyContent: "center"
        },
        body: {
          flex: 1,
          paddingVertical: 8,
          paddingRight: 10,
          gap: 2,
          justifyContent: "center"
        },
        hostRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4
        },
        host: {
          fontSize: 10,
          color: colors.ink3,
          letterSpacing: 0.6,
          fontWeight: "600",
          flex: 1
        },
        title: {
          fontSize: 14,
          fontWeight: "500",
          color: colors.ink
        },
        description: {
          fontSize: 12,
          color: colors.ink2,
          lineHeight: 16
        },
        loading: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.creamSoft,
          borderRadius: 8
        },
        loadingText: {
          fontSize: 12,
          color: colors.ink2
        },
        errorBox: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.creamSoft
        },
        errorText: {
          fontSize: 12,
          color: colors.ink2
        }
      }),
    [colors]
  );

  const query = trpc.urlPreview.fetch.useQuery(
    { url },
    {
      staleTime: 60_000,
      retry: false
    }
  );

  if (query.isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} size="small" />
        <Text style={styles.loadingText}>Loading preview…</Text>
      </View>
    );
  }

  if (query.error) {
    const reason = getCauseReason(query.error);
    if (reason === "URL_NO_METADATA") return null;
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>Couldn&apos;t load a preview for that URL.</Text>
      </View>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="link"
      accessibilityLabel={`Open ${data.title ?? data.hostName} in browser`}
    >
      {data.imageUrl ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={24} color={colors.ink3} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.hostRow}>
          <Text style={styles.host} numberOfLines={1}>
            {data.hostName.toUpperCase()}
          </Text>
          <Ionicons name="open-outline" size={11} color={colors.ink3} />
        </View>
        {data.title ? (
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
        ) : null}
        {data.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {data.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function getCauseReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: { cause?: { reason?: unknown } } }).data;
  const reason = data?.cause?.reason;
  return typeof reason === "string" ? reason : null;
}
