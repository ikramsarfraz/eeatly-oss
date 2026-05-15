import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Round 15 — Add tab entry. Two cards: manual logging + AI capture.
 *
 * The AI capture card routes to a unified screen where the user picks
 * from four input modes (Photo / Text / Voice / YouTube) via an
 * in-screen tab strip. Earlier rounds had three separate cards (one
 * per input mode) on this tab; consolidated in R15 Task 4 so the
 * mode strip is the source of truth.
 *
 * Cards are full-width pressables (≥80px tall) so thumb taps land
 * easily even with wet kitchen hands.
 */
export default function AddTab() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Add a meal</Text>
        <Text style={styles.body}>
          Quick log if you know what you cooked, or let AI extract a
          recipe from a photo, voice note, pasted text, or YouTube link.
        </Text>

        <Card
          href="/(authed)/add/log"
          title="Log a meal I cooked"
          subtitle="Name, when, optional photo + notes."
          icon="restaurant-outline"
          primary
        />

        <Card
          href="/(authed)/add/ai-suggest"
          title="Capture with AI"
          subtitle="Photo, voice note, pasted text, or YouTube link."
          icon="sparkles-outline"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({
  href,
  title,
  subtitle,
  icon,
  primary
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          primary && styles.cardPrimary,
          pressed && styles.cardPressed
        ]}
      >
        <View
          style={[styles.cardIcon, primary && styles.cardIconPrimary]}
        >
          <Ionicons
            name={icon}
            size={24}
            color={primary ? "#fff" : "#2f6f58"}
          />
        </View>
        <View style={styles.cardBody}>
          <Text
            style={[styles.cardTitle, primary && styles.cardTitlePrimary]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.cardSubtitle, primary && styles.cardSubtitlePrimary]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={primary ? "rgba(255,255,255,0.7)" : "#aaa"}
        />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfa" },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32
  },
  heading: {
    fontSize: 26,
    fontWeight: "600",
    color: "#111",
    marginTop: 4
  },
  body: {
    fontSize: 14,
    color: "#555",
    marginBottom: 16
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e3dc",
    minHeight: 80
  },
  cardPrimary: {
    backgroundColor: "#2f6f58",
    borderColor: "#2f6f58"
  },
  cardPressed: {
    opacity: 0.85
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eef2ef",
    alignItems: "center",
    justifyContent: "center"
  },
  cardIconPrimary: {
    backgroundColor: "rgba(255,255,255,0.18)"
  },
  cardBody: {
    flex: 1,
    gap: 2
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111"
  },
  cardTitlePrimary: {
    color: "#fff"
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#666"
  },
  cardSubtitlePrimary: {
    color: "rgba(255,255,255,0.85)"
  }
});
