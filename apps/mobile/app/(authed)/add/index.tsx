import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { TopNav } from "../../../components/top-nav";
import { colors } from "../../../lib/design/tokens";
import {
  IconBubble,
  PageTitle,
  Screen,
  SectionLabel
} from "../../../components/ui";

/**
 * Round 18 Add tab — editorial rebuild.
 *
 * TopNav (Add, gear, no divider) → big serif "Add a meal" title +
 * subtitle → CAPTURE section with primary forest card + two secondary
 * surface cards → PLANS section with one row card.
 *
 * Primary card uses forest bg + cream text + translucent icon bubble.
 * Secondary cards use surface bg + sage IconBubble + ink text.
 */
export default function AddTab() {
  return (
    <Screen>
      <TopNav title="Add" divider={false} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 8,
          paddingBottom: 32
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 22 }}>
          <PageTitle
            title="Add a meal"
            size="md"
            subtitle="Quick-log what you cooked, or let AI lift a recipe from a photo, voice note, or pasted text."
          />
        </View>

        <SectionLabel>Capture</SectionLabel>
        <View style={{ gap: 10, marginBottom: 28 }}>
          <AddOption
            href="/(authed)/add/log"
            iconName="restaurant-outline"
            title="Log a meal I cooked"
            subtitle="Name, when, optional photo + notes."
            primary
          />
          <AddOption
            href="/(authed)/add/ai-suggest"
            iconName="sparkles-outline"
            title="Capture with AI"
            subtitle="Photo, voice note, or pasted text."
          />
          <AddOption
            href="/(authed)/add/log"
            iconName="link-outline"
            title="Save a link"
            subtitle="YouTube, TikTok, Pinterest, or a recipe URL."
          />
        </View>

        <SectionLabel>Plans</SectionLabel>
        <AddOption
          href="/(authed)/plans"
          iconName="calendar-outline"
          title="Plan an occasion menu"
          subtitle="Eid, Diwali, dinner party."
        />
      </ScrollView>
    </Screen>
  );
}

function AddOption({
  href,
  iconName,
  title,
  subtitle,
  primary
}: {
  href: string;
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  const iconColor = primary ? colors.forestText : colors.forest;
  const titleColor = primary ? "#F5EFE2" : colors.ink;
  const subtitleColor = primary ? "rgba(245,239,226,0.75)" : colors.ink2;
  const chevronColor = primary ? "rgba(245,239,226,0.7)" : colors.ink3;

  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 16,
          borderRadius: 14,
          backgroundColor: primary ? colors.forest : colors.surface,
          borderWidth: primary ? 0 : 1,
          borderColor: colors.borderSoft,
          shadowColor: primary ? colors.forest : "#000",
          shadowOpacity: primary ? 0.35 : 0.04,
          shadowOffset: { width: 0, height: primary ? 6 : 2 },
          shadowRadius: primary ? 20 : 6,
          elevation: primary ? 4 : 1
        }}
        className="active:opacity-90"
      >
        <IconBubble size={42} onPrimary={primary}>
          <Ionicons name={iconName} size={22} color={iconColor} />
        </IconBubble>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: 15.5,
              color: titleColor,
              letterSpacing: -0.15
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: "Geist_400Regular",
              fontSize: 12.5,
              color: subtitleColor,
              lineHeight: 17
            }}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={chevronColor} />
      </Pressable>
    </Link>
  );
}
