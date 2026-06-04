import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../lib/design/use-theme-colors";

/**
 * Round 18 — custom bottom tab bar that mirrors the design handoff:
 *
 *   - Cream bg, hairline top border (no shadow).
 *   - Active tab: filled icon + sage-bg pill behind icon + forest
 *     foreground + 600 weight Geist label.
 *   - Inactive tab: outline icon, ink-3 foreground, 500 weight label.
 *
 * React Navigation's default tab bar can't render a pill behind the
 * active icon, hence the custom implementation. We map each route name
 * to an icon pair (outline + filled) lookup table — only the visible
 * tabs (home / add / library) appear; everything else is hidden via
 * `href: null` in the layout config.
 */
const ICON_BY_ROUTE: Record<
  string,
  { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap; label: string }
> = {
  "home/index": { outline: "home-outline", filled: "home", label: "Home" },
  "add/index": {
    outline: "add-circle-outline",
    filled: "add-circle",
    label: "Add"
  },
  "library/index": {
    outline: "book-outline",
    filled: "book",
    label: "Library"
  }
};

export function EeatlyTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => ICON_BY_ROUTE[r.name]);

  return (
    <View
      style={{
        backgroundColor: colors.cream,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 8,
        flexDirection: "row",
        justifyContent: "space-around"
      }}
    >
      {visibleRoutes.map((route) => {
        const meta = ICON_BY_ROUTE[route.name];
        const focusedRouteName = state.routes[state.index]?.name;
        const isFocused = focusedRouteName === route.name;
        const tint = isFocused ? colors.forest : colors.ink3;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 4,
              gap: 4
            }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 4,
                borderRadius: 99,
                backgroundColor: isFocused ? colors.sageBg : "transparent",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons
                name={isFocused ? meta.filled : meta.outline}
                size={22}
                color={tint}
              />
            </View>
            <Text
              style={{
                fontFamily: isFocused
                  ? "Geist_600SemiBold"
                  : "Geist_500Medium",
                fontSize: 10.5,
                color: tint,
                letterSpacing: 0.2
              }}
              allowFontScaling={false}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
