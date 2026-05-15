import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card, Screen, SectionHeader } from "../../../components/ui";

/**
 * Round 17 — Add tab entry.
 *
 * Three large interactive cards, each with icon + title + subtitle:
 *   1. Log a meal I cooked — manual entry (the everyday path).
 *   2. Capture with AI — opens the unified AI screen
 *      (Photo / Text / Voice modes).
 *   3. Save a link — placeholder for the R16 URL-references flow.
 *      Today it routes to the manual log form with a URL field
 *      focused; a future round can give it its own screen.
 *
 * Cards are full-width pressables (≥96 px tall), 20 px internal
 * padding so each option feels generous on a phone. Tap targets
 * exceed the iOS HIG 44 pt minimum by a margin.
 */
export default function AddTab() {
  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerClassName="px-4 pb-12">
        <View className="pt-2 pb-2">
          <Text className="text-heading-1 font-bold text-foreground">
            Add a meal
          </Text>
          <Text className="text-body text-foreground-muted mt-1">
            Quick log if you know what you cooked, or let AI extract a recipe
            from a photo, voice note, or pasted text.
          </Text>
        </View>

        <View className="gap-3 mt-4">
          <AddOption
            href="/(authed)/add/log"
            icon="restaurant-outline"
            title="Log a meal I cooked"
            subtitle="Name, when, optional photo + notes."
            primary
          />
          <AddOption
            href="/(authed)/add/ai-suggest"
            icon="sparkles-outline"
            title="Capture with AI"
            subtitle="Photo, voice note, or pasted text."
          />
          <AddOption
            href="/(authed)/add/log"
            icon="link-outline"
            title="Save a link"
            subtitle="YouTube, TikTok, Pinterest, or a recipe URL."
          />
        </View>

        <SectionHeader title="Plans" />
        <Link href="/(authed)/plans" asChild>
          <Pressable>
            <Card variant="interactive">
              <View className="flex-row items-center gap-3 p-4">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color="#2C5F3F"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-body font-semibold text-foreground">
                    Plan an occasion menu
                  </Text>
                  <Text className="text-caption text-foreground-muted">
                    Eid, Diwali, dinner party.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9A968A" />
              </View>
            </Card>
          </Pressable>
        </Link>
      </ScrollView>
    </Screen>
  );
}

function AddOption({
  href,
  icon,
  title,
  subtitle,
  primary
}: {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        className={`flex-row items-center gap-4 rounded-md p-5 min-h-[96px] shadow-sm active:opacity-90 ${
          primary
            ? "bg-primary"
            : "bg-background-elevated border border-border"
        }`}
      >
        <View
          className={`h-12 w-12 items-center justify-center rounded-full ${
            primary ? "bg-primary-foreground/20" : "bg-primary-muted"
          }`}
        >
          <Ionicons
            name={icon}
            size={24}
            color={primary ? "#FBF8F1" : "#2C5F3F"}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            className={`text-heading-3 font-semibold ${
              primary ? "text-primary-foreground" : "text-foreground"
            }`}
          >
            {title}
          </Text>
          <Text
            className={`text-caption ${
              primary
                ? "text-primary-foreground/80"
                : "text-foreground-muted"
            }`}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={primary ? "rgba(251,248,241,0.6)" : "#9A968A"}
        />
      </Pressable>
    </Link>
  );
}
