import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "../lib/design/use-theme-colors";

/**
 * Round 18/19 — in-body top nav, replacing the native Stack/Tabs header.
 *
 * Layout: optional left slot (back chevron or text button) → centered
 * 16pt Geist title → optional right slot (gear icon or text button).
 * Optional hairline divider at the bottom — disabled on Home/Add
 * where the editorial serif title is the visual anchor.
 *
 * Header sits flush under the system status bar (the parent Screen
 * supplies the safe-area inset).
 */
type TopNavProps = {
  title?: string;
  divider?: boolean;
  /** Show a back chevron on the left that calls router.back(). */
  back?: boolean;
  /** Text-button left slot — overrides `back`. Used by modal screens
   *  ("Cancel" / "Save"). */
  leftLabel?: string;
  onLeftPress?: () => void;
  /** Default right gear that deep-links to /(authed)/settings. Set
   *  `false` to hide; pass `rightLabel` / `onRightPress` to override
   *  with a text button. */
  showSettings?: boolean;
  rightLabel?: string;
  onRightPress?: () => void;
  /** Right slot override for arbitrary content (custom icons etc.). */
  right?: React.ReactNode;
};

export function TopNav({
  title,
  divider = true,
  back,
  leftLabel,
  onLeftPress,
  showSettings = true,
  rightLabel,
  onRightPress,
  right
}: TopNavProps) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.cream,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border
      }}
    >
      <View
        style={{
          height: 44,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center"
        }}
      >
        <View style={{ width: 80, alignItems: "flex-start" }}>
          {leftLabel ? (
            <Pressable
              onPress={onLeftPress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={leftLabel}
            >
              <Text
                style={{
                  fontFamily: "Geist_500Medium",
                  fontSize: 15,
                  color: colors.forest
                }}
              >
                {leftLabel}
              </Text>
            </Pressable>
          ) : back ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.forest} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: "center" }}>
          {title ? (
            <Text
              style={{
                fontFamily: "Geist_600SemiBold",
                fontSize: 16,
                color: colors.ink,
                letterSpacing: -0.1
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </View>

        <View style={{ width: 80, alignItems: "flex-end" }}>
          {right ? (
            right
          ) : rightLabel ? (
            <Pressable
              onPress={onRightPress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={rightLabel}
            >
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 15,
                  color: colors.forest
                }}
              >
                {rightLabel}
              </Text>
            </Pressable>
          ) : showSettings ? (
            <Link href="/(authed)/settings" asChild>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.forest}
                />
              </Pressable>
            </Link>
          ) : null}
        </View>
      </View>
    </View>
  );
}
