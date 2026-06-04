import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { detectPlatform } from "@eeatly/shared";
import { UrlPreviewCard } from "./url-preview-card";
import { useThemeColors } from "../../lib/design/use-theme-colors";

/**
 * Mobile equivalent of the web `SourceUrlInputPreview`. Shows a small
 * platform badge for recognised hosts, or the OG preview card for
 * generic web URLs. Debounced 400ms so each keystroke doesn't fire
 * a fetch.
 *
 * R19.7: hint text color reads from `useThemeColors()` and the
 * StyleSheet is memoised on the palette reference.
 */
type Props = {
  url: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube video",
  tiktok: "TikTok video",
  pinterest: "Pinterest pin",
  instagram: "Instagram post"
};

export function SourceUrlInputPreview({ url }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        hint: {
          fontSize: 12,
          color: colors.ink2,
          lineHeight: 18
        },
        hintStrong: {
          color: colors.ink,
          fontWeight: "500"
        },
        cardWrap: {
          marginTop: 4
        }
      }),
    [colors]
  );

  const trimmed = url.trim();
  const [debouncedUrl, setDebouncedUrl] = useState(trimmed);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedUrl(trimmed), 400);
    return () => clearTimeout(handle);
  }, [trimmed]);

  if (!debouncedUrl) return null;

  const detected = detectPlatform(debouncedUrl);
  if (!detected) {
    return (
      <Text style={styles.hint}>
        We&apos;ll save this URL even if it isn&apos;t a recognised platform.
      </Text>
    );
  }

  if (detected.platform === "web" || detected.platform === "instagram") {
    return (
      <View style={styles.cardWrap}>
        <UrlPreviewCard url={detected.canonicalUrl} />
      </View>
    );
  }

  return (
    <Text style={styles.hint}>
      Recognised as a{" "}
      <Text style={styles.hintStrong}>{PLATFORM_LABEL[detected.platform]}</Text>.
      We&apos;ll embed it on the recipe page.
    </Text>
  );
}
