import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { detectPlatform } from "@eeatly/shared";
import { UrlPreviewCard } from "./url-preview-card";

/**
 * Mobile equivalent of the web `SourceUrlInputPreview`. Shows a small
 * platform badge for recognised hosts, or the OG preview card for
 * generic web URLs. Debounced 400ms so each keystroke doesn't fire
 * a fetch.
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

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18
  },
  hintStrong: {
    color: "#222",
    fontWeight: "500"
  },
  cardWrap: {
    marginTop: 4
  }
});
